import { DEFAULT_PORT } from '@/dashboard/host.js';

export type DashboardArgs =
  | { success: true; port: number; shouldOpen: boolean }
  | { success: false; error: string };

const USAGE = 'usage: npm run dashboard [-- --port N] [--no-open]';

export function parseDashboardArgs(argv: readonly string[]): DashboardArgs {
  let port = DEFAULT_PORT;
  let shouldOpen = true;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--no-open') {
      shouldOpen = false;
      continue;
    }
    const value = Number(argv[i + 1]);
    if (arg !== '--port' || !Number.isInteger(value)) {
      return { success: false, error: USAGE };
    }
    if (value < 1024 || value > 65535) {
      return { success: false, error: 'port must be 1024–65535' };
    }
    port = value;
    i += 1;
  }
  return { success: true, port, shouldOpen };
}
