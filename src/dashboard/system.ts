import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { targetFrom } from '@/dashboard/gates.js';
import type { Spawner } from '@/dashboard/runner.js';
import type { LoadTarget } from '@/config/env.schema.js';
import { DATA_DIRS } from '@/config/data-dirs.js';
import { MANIFEST, sha256 } from '@/dataset/files.js';

export const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ENV_FILE = path.join(REPO_ROOT, '.env');

// No shell: argv straight to the process
export function processSpawner(env: NodeJS.ProcessEnv): Spawner {
  return (argv, onLine) =>
    new Promise((resolve) => {
      const [command = '', ...args] = argv;
      const child = spawn(command, args, {
        cwd: REPO_ROOT,
        env: { ...env, NO_COLOR: '1', FORCE_COLOR: '0' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const pending: Promise<void>[] = [];
      for (const [stream, name] of [
        [child.stdout, 'out'],
        [child.stderr, 'err'],
      ] as const) {
        const lines = createInterface({ input: stream });
        lines.on('line', (line) => onLine(line, name));
        pending.push(new Promise((done) => lines.on('close', done)));
      }
      child.on('error', (error: NodeJS.ErrnoException) => {
        onLine(`could not start ${command}: ${error.code ?? 'error'}`, 'err');
        resolve(127);
      });
      child.on('close', (code) => {
        void Promise.all(pending).then(() => resolve(code ?? 1));
      });
    });
}

export function manifestHash(): string | null {
  const file = path.join(DATA_DIRS.dataset, MANIFEST);
  return existsSync(file) ? sha256(readFileSync(file, 'utf8')) : null;
}

export function isDatasetDirty(): boolean {
  const run = spawnSync(
    'git',
    ['status', '--porcelain', '--', 'data/dataset'],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    },
  );
  return run.status === 0 && run.stdout.trim() !== '';
}

// Fresh each call: .env may change while it runs
export function currentTarget(
  shell: Readonly<Record<string, string | undefined>>,
): LoadTarget | null {
  const text = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8') : null;
  return targetFrom(shell, text);
}
