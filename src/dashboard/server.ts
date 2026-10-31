import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseActionRequest } from '@/dashboard/actions.js';
import type { Control } from '@/dashboard/control.js';
import { checkActionHeaders } from '@/dashboard/guard.js';
import { historyView } from '@/dashboard/history.js';
import { HOST, isAllowedHost } from '@/dashboard/host.js';
import type { Snapshot } from '@/dashboard/read.js';
import type { SizesView } from '@/dashboard/sizes.js';
import {
  coverageView,
  failuresView,
  linksView,
  overview,
} from '@/dashboard/views.js';

export { DEFAULT_PORT, HOST, isAllowedHost } from '@/dashboard/host.js';

export const PUBLIC_DIR = fileURLToPath(new URL('public/', import.meta.url));

// The page carries the token; nothing else can act
export const TOKEN_PLACEHOLDER = '__DASHBOARD_TOKEN__';

const STATIC: Record<string, { file: string; type: string }> = {
  '/': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/app.js': { file: 'app.js', type: 'text/javascript; charset=utf-8' },
  '/style.css': { file: 'style.css', type: 'text/css; charset=utf-8' },
};

const ACTION_PATH = /^\/api\/actions\/([a-z-]+)$/;
const MAX_BODY = 1024;

export interface Deps {
  port: number;
  snapshot: () => Snapshot;
  sizes: (refresh: boolean) => Promise<SizesView>;
  publicDir?: string;
  // S19b: without them the page is read only
  control?: Control;
  token?: string;
}

function send(res: ServerResponse, status: number, type: string, body: string) {
  res.writeHead(status, {
    'content-type': type,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(body);
}

function json(res: ServerResponse, status: number, value: unknown) {
  send(res, status, 'application/json; charset=utf-8', JSON.stringify(value));
}

function text(params: URLSearchParams, name: string): string | undefined {
  return params.get(name) || undefined;
}

function page(params: URLSearchParams): number | undefined {
  const value = Number(params.get('page'));
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

// Server-Sent Events: one JSON event per line
function stream(control: Control, req: IncomingMessage, res: ServerResponse) {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store',
    connection: 'keep-alive',
  });
  res.write(': connected\n\n');
  const stop = control.subscribe((event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });
  const ping = setInterval(() => res.write(': ping\n\n'), 15_000);
  req.on('close', () => {
    clearInterval(ping);
    stop();
  });
}

async function route(
  deps: Deps,
  url: URL,
  req: IncomingMessage,
  res: ServerResponse,
) {
  const params = url.searchParams;
  switch (url.pathname) {
    case '/api/overview':
      return json(res, 200, overview(deps.snapshot()));
    case '/api/coverage':
      return json(res, 200, coverageView(deps.snapshot()));
    case '/api/links':
      return json(
        res,
        200,
        linksView(deps.snapshot().entries, {
          type: text(params, 'type'),
          status: text(params, 'status'),
          group: text(params, 'group'),
          competition: text(params, 'competition'),
          season: text(params, 'season'),
          q: text(params, 'q'),
          page: page(params),
        }),
      );
    case '/api/history':
      return json(
        res,
        200,
        historyView(deps.snapshot().log, {
          kind: text(params, 'kind'),
          result: text(params, 'result'),
          from: text(params, 'from'),
          to: text(params, 'to'),
          page: page(params),
        }),
      );
    case '/api/failures':
      return json(
        res,
        200,
        failuresView(deps.snapshot(), deps.control?.lastRuns()),
      );
    case '/api/sizes':
      return json(res, 200, await deps.sizes(params.get('refresh') === '1'));
    case '/api/run':
      return json(res, 200, deps.control?.status() ?? null);
    case '/api/run/stream':
      if (!deps.control) return json(res, 404, { error: 'no actions' });
      return stream(deps.control, req, res);
  }
  const asset = STATIC[url.pathname];
  if (!asset) return json(res, 404, { error: 'not found' });
  const dir = deps.publicDir ?? PUBLIC_DIR;
  const body = readFileSync(path.join(dir, asset.file), 'utf8');
  send(res, 200, asset.type, body.replace(TOKEN_PLACEHOLDER, deps.token ?? ''));
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      body += chunk;
      if (body.length > MAX_BODY) reject(new Error('body too large'));
    });
    req.on('end', () => {
      try {
        resolve(body.trim() ? JSON.parse(body) : {});
      } catch {
        reject(new Error('body is not JSON'));
      }
    });
    req.on('error', reject);
  });
}

async function act(
  deps: Deps,
  id: string,
  req: IncomingMessage,
  res: ServerResponse,
) {
  const { control, token } = deps;
  if (!control || !token) return json(res, 404, { error: 'no actions' });
  const refused = checkActionHeaders(req.headers, token, deps.port);
  if (refused) return json(res, 403, { error: refused });
  let body: unknown;
  try {
    body = await readBody(req);
  } catch (error) {
    return json(res, 400, { error: (error as Error).message });
  }
  const request = parseActionRequest(id, body);
  if (!request.success) return json(res, 400, { error: request.error });
  const outcome = control.start(request.id, request.count);
  if (!outcome.success) {
    return json(res, outcome.status, { error: outcome.error });
  }
  return json(res, 202, { started: request.id });
}

export function createHandler(deps: Deps) {
  return (req: IncomingMessage, res: ServerResponse): void => {
    if (!isAllowedHost(req.headers.host, deps.port)) {
      return json(res, 403, { error: 'forbidden host' });
    }
    const url = new URL(req.url ?? '/', `http://${HOST}:${deps.port}`);
    const action = ACTION_PATH.exec(url.pathname);
    let handled: Promise<void>;
    if (req.method === 'POST' && action?.[1]) {
      handled = act(deps, action[1], req, res);
    } else if (req.method === 'GET') {
      handled = route(deps, url, req, res);
    } else {
      return json(res, 405, { error: 'method not allowed' });
    }
    handled.catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      json(res, 500, { error: message.split('\n')[0] });
    });
  };
}
