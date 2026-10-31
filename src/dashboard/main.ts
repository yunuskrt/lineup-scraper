import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { parseDashboardArgs } from '@/dashboard/args.js';
import { createControl } from '@/dashboard/control.js';
import { readSnapshot } from '@/dashboard/read.js';
import { Runner } from '@/dashboard/runner.js';
import { sizesView, type SizesView } from '@/dashboard/sizes.js';
import { readSizes } from '@/dashboard/sizes-read.js';
import { createHandler, HOST } from '@/dashboard/server.js';
import {
  currentTarget,
  isDatasetDirty,
  manifestHash,
  processSpawner,
} from '@/dashboard/system.js';

// Before .env: commands read .env themselves
const shellEnv = { ...process.env };

// tsx doesn't read .env itself
if (existsSync('.env')) process.loadEnvFile('.env');

const args = parseDashboardArgs(process.argv.slice(2));
if (!args.success) {
  console.error(args.error);
  process.exit(2);
}
const { port, shouldOpen } = args;

// D3: read on demand, then cached
let cached: SizesView | null = null;
async function sizes(refresh: boolean): Promise<SizesView> {
  if (cached === null || refresh) {
    cached = sizesView(await readSizes(), new Date());
  }
  return cached;
}

const control = createControl({
  runner: new Runner(processSpawner(shellEnv)),
  target: () => currentTarget(shellEnv),
  manifestHash,
  isDatasetDirty,
});

const server = createServer(
  createHandler({
    port,
    snapshot: readSnapshot,
    sizes,
    control,
    token: randomBytes(24).toString('hex'),
  }),
);

server.on('error', (error: NodeJS.ErrnoException) => {
  console.error(
    error.code === 'EADDRINUSE'
      ? `port ${port} is taken: stop the other dashboard, or use -- --port N`
      : `dashboard failed: ${error.message}`,
  );
  process.exit(1);
});

server.listen(port, HOST, () => {
  const url = `http://${HOST}:${port}/`;
  console.log(`dashboard: ${url} (Ctrl+C stops it)`);
  if (shouldOpen && process.platform === 'darwin') {
    const opener = spawn('open', [url], { stdio: 'ignore', detached: true });
    // The URL is printed: a failed open is harmless
    opener.on('error', () => undefined);
    opener.unref();
  }
});
