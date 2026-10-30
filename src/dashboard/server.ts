import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { historyView } from '@/dashboard/history.js';
import type { Snapshot } from '@/dashboard/read.js';
import type { SizesView } from '@/dashboard/sizes.js';
import {
  coverageView,
  failuresView,
  linksView,
  overview,
} from '@/dashboard/views.js';

export const DEFAULT_PORT = 4319;
export const HOST = '127.0.0.1';

export const PUBLIC_DIR = fileURLToPath(new URL('public/', import.meta.url));

const STATIC: Record<string, { file: string; type: string }> = {
  '/': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/app.js': { file: 'app.js', type: 'text/javascript; charset=utf-8' },
  '/style.css': { file: 'style.css', type: 'text/css; charset=utf-8' },
};

export interface Deps {
  port: number;
  snapshot: () => Snapshot;
  sizes: (refresh: boolean) => Promise<SizesView>;
  publicDir?: string;
}

// Loopback names only: blocks DNS rebinding
export function isAllowedHost(host: string | undefined, port: number) {
  return host === `${HOST}:${port}` || host === `localhost:${port}`;
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

async function route(deps: Deps, url: URL, res: ServerResponse) {
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
      return json(res, 200, failuresView(deps.snapshot()));
    case '/api/sizes':
      return json(res, 200, await deps.sizes(params.get('refresh') === '1'));
  }
  const asset = STATIC[url.pathname];
  if (!asset) return json(res, 404, { error: 'not found' });
  const dir = deps.publicDir ?? PUBLIC_DIR;
  send(res, 200, asset.type, readFileSync(path.join(dir, asset.file), 'utf8'));
}

export function createHandler(deps: Deps) {
  return (req: IncomingMessage, res: ServerResponse): void => {
    if (!isAllowedHost(req.headers.host, deps.port)) {
      return json(res, 403, { error: 'forbidden host' });
    }
    if (req.method !== 'GET') {
      return json(res, 405, { error: 'read only' });
    }
    const url = new URL(req.url ?? '/', `http://${HOST}:${deps.port}`);
    route(deps, url, res).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      json(res, 500, { error: message.split('\n')[0] });
    });
  };
}
