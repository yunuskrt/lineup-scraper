import type { LoadTarget } from '@/config/env.schema.js';

export interface LoadArgs {
  apply: boolean;
  target: string | null;
  confirm: boolean;
}

export type ArgsResult =
  { success: true; args: LoadArgs } | { success: false; error: string };

export type TargetResult =
  | { success: true; allowProduction: boolean }
  | { success: false; error: string };

export function parseArgs(argv: readonly string[]): ArgsResult {
  const args: LoadArgs = { apply: false, target: null, confirm: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') continue;
    if (arg === '--apply') args.apply = true;
    else if (arg === '--confirm') args.confirm = true;
    else if (arg === '--target' && argv[i + 1]) {
      args.target = argv[i + 1];
      i += 1;
    } else {
      return { success: false, error: `Unknown argument ${arg}` };
    }
  }
  return { success: true, args };
}

// Production: env, flag and confirm, all three
export function checkTarget(target: LoadTarget, args: LoadArgs): TargetResult {
  if (args.apply) {
    return {
      success: false,
      error: '--apply arrives in S15b; this is a dry run only',
    };
  }
  if (args.target !== null && args.target !== target) {
    return {
      success: false,
      error: `--target ${args.target} differs from LOAD_TARGET=${target}`,
    };
  }
  if (target !== 'production') return { success: true, allowProduction: false };
  if (args.target !== 'production' || !args.confirm) {
    return {
      success: false,
      error: 'LOAD_TARGET=production needs --target production --confirm',
    };
  }
  return { success: true, allowProduction: true };
}
