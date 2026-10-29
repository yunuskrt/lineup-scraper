import { parseArgs, type ArgsResult } from '@/load/target.js';

// The loader's flags, but never --apply
export function parseVerifyArgs(argv: readonly string[]): ArgsResult {
  const parsed = parseArgs(argv);
  if (parsed.success && parsed.args.apply) {
    return { success: false, error: 'verify only reads: no --apply' };
  }
  return parsed;
}
