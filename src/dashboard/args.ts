import { DEFAULT_PORT } from '@/dashboard/server.js';

export type DashboardArgs =
  { success: true; port: number } | { success: false; error: string };

const USAGE = 'usage: npm run dashboard [-- --port N]';

export function parseDashboardArgs(argv: readonly string[]): DashboardArgs {
  if (argv.length === 0) return { success: true, port: DEFAULT_PORT };
  const [flag, value, ...rest] = argv;
  const port = Number(value);
  if (flag !== '--port' || rest.length > 0 || !Number.isInteger(port)) {
    return { success: false, error: USAGE };
  }
  if (port < 1024 || port > 65535) {
    return { success: false, error: 'port must be 1024–65535' };
  }
  return { success: true, port };
}
