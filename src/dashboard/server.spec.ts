import type { IncomingMessage, ServerResponse } from 'node:http';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseDashboardArgs } from '@/dashboard/args.js';
import type { Snapshot } from '@/dashboard/read.js';
import { createHandler, isAllowedHost, type Deps } from '@/dashboard/server.js';
import { sizesView } from '@/dashboard/sizes.js';
import { entry } from '@/dashboard/spec-fixtures.js';
import { CONFIG } from '@/pool/spec-fixtures.js';

const PORT = 4319;

const SNAPSHOT: Snapshot = {
  config: CONFIG,
  matches: [],
  entries: [entry('Player', 'saved'), entry('Player', 'error: bad', {}, '2')],
  log: [],
  inbox: [],
  notes: [],
  problems: [],
  csvAt: 2,
  sourcesAt: [1],
};

interface Reply {
  status: number;
  headers: Record<string, string>;
  body: string;
}

function request(
  deps: Deps,
  url: string,
  extra: Partial<IncomingMessage> = {},
) {
  return new Promise<Reply>((resolve) => {
    const reply: Reply = { status: 0, headers: {}, body: '' };
    const res = {
      writeHead(status: number, headers: Record<string, string>) {
        reply.status = status;
        reply.headers = headers;
      },
      end(body: string) {
        reply.body = body;
        resolve(reply);
      },
    } as unknown as ServerResponse;
    const req = {
      method: 'GET',
      url,
      headers: { host: `127.0.0.1:${PORT}` },
      ...extra,
    } as IncomingMessage;
    createHandler(deps)(req, res);
  });
}

function deps(publicDir?: string): Deps {
  return {
    port: PORT,
    snapshot: () => SNAPSHOT,
    sizes: (refresh) =>
      Promise.resolve(
        sizesView(
          {
            target: refresh ? 'fresh' : 'cached',
            tables: null,
            databaseBytes: null,
            bucket: null,
            notes: [],
          },
          new Date(0),
        ),
      ),
    publicDir,
  };
}

describe('isAllowedHost', () => {
  it('allows only its own loopback host and port', () => {
    expect(isAllowedHost('127.0.0.1:4319', PORT)).toBe(true);
    expect(isAllowedHost('localhost:4319', PORT)).toBe(true);
    expect(isAllowedHost('127.0.0.1:80', PORT)).toBe(false);
    expect(isAllowedHost('evil.example:4319', PORT)).toBe(false);
    expect(isAllowedHost(undefined, PORT)).toBe(false);
  });
});

describe('createHandler', () => {
  it('refuses a foreign host and any write', async () => {
    const foreign = await request(deps(), '/api/overview', {
      headers: { host: 'evil.example:4319' },
    });
    expect(foreign.status).toBe(403);
    expect(
      (await request(deps(), '/api/overview', { method: 'POST' })).status,
    ).toBe(405);
  });

  it('serves the views as JSON', async () => {
    const links = await request(deps(), '/api/links?status=error');
    expect(links.status).toBe(200);
    expect(JSON.parse(links.body)).toMatchObject({
      total: 1,
      rows: [{ key: '2' }],
    });
    const failures = await request(deps(), '/api/failures');
    expect(JSON.parse(failures.body)).toHaveLength(1);
    const overview = JSON.parse((await request(deps(), '/api/overview')).body);
    expect(overview.totals[0]).toMatchObject({
      type: 'Player',
      total: 2,
      errors: 1,
    });
  });

  it('reads sizes on demand: refresh=1 rereads', async () => {
    const cached = await request(deps(), '/api/sizes');
    const fresh = await request(deps(), '/api/sizes?refresh=1');
    expect(JSON.parse(cached.body).target).toBe('cached');
    expect(JSON.parse(fresh.body).target).toBe('fresh');
  });

  it('serves only the three page files', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dashboard-'));
    writeFileSync(path.join(dir, 'index.html'), '<p>hi</p>');
    const page = await request(deps(dir), '/');
    expect([page.status, page.body]).toEqual([200, '<p>hi</p>']);
    expect(page.headers['content-type']).toMatch(/^text\/html/);
    expect((await request(deps(dir), '/../package.json')).status).toBe(404);
  });

  it('answers a failed read with 500 and its first line', async () => {
    const broken: Deps = {
      ...deps(),
      snapshot: () => {
        throw new Error('bad file\nmore');
      },
    };
    const reply = await request(broken, '/api/overview');
    expect([reply.status, JSON.parse(reply.body)]).toEqual([
      500,
      { error: 'bad file' },
    ]);
  });
});

describe('parseDashboardArgs', () => {
  it('defaults to 4319 and takes --port', () => {
    expect(parseDashboardArgs([])).toEqual({ success: true, port: 4319 });
    expect(parseDashboardArgs(['--port', '5000'])).toEqual({
      success: true,
      port: 5000,
    });
  });

  it('refuses anything else', () => {
    expect(parseDashboardArgs(['--port']).success).toBe(false);
    expect(parseDashboardArgs(['--port', '80']).success).toBe(false);
    expect(parseDashboardArgs(['--apply']).success).toBe(false);
  });
});
