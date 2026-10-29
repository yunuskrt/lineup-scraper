import type { LoadArgs } from '@/load/target.js';

type ArgsResult =
  { success: true; args: LoadArgs } | { success: false; error: string };

export function parseImageArgs(argv: readonly string[]): ArgsResult {
  const args: LoadArgs = { apply: false, target: null, confirm: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--upload') args.apply = true;
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
