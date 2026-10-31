import { z } from 'zod';

export const ACTION_IDS = [
  'status',
  'open',
  'import',
  'build',
  'upload',
  'schema',
  'dry-run',
  'verify',
  'batch',
  'load',
] as const;
export type ActionId = (typeof ACTION_IDS)[number];

export interface Step {
  label: string;
  argv: string[];
}

export interface ActionDef {
  id: ActionId;
  label: string;
  // Reads or writes the LOAD_TARGET branch
  needsIngest: boolean;
}

export const OPEN_COUNT = { min: 1, max: 50, default: 10 } as const;

const npm = (...args: string[]): Step => ({
  label: `npm run ${args.join(' ')}`,
  argv: ['npm', 'run', '--silent', ...args],
});

const uv = (...args: string[]): Step => ({
  label: `uv run python -m ${args.join(' ')}`,
  argv: ['uv', 'run', 'python', '-m', ...args],
});

// --target makes each command refuse another branch
const TARGET = ['--target', 'ingest'];

export const STEPS = {
  status: npm('status'),
  import: uv('extract.inbox'),
  build: npm('build'),
  upload: npm('images', '--', '--upload', ...TARGET),
  schema: npm('db:check'),
  dryRun: npm('load', '--', ...TARGET),
  apply: npm('load', '--', '--apply', ...TARGET),
  verify: npm('verify', '--', ...TARGET),
} as const;

export const ACTIONS: Record<ActionId, ActionDef> = {
  status: { id: 'status', label: 'Refresh status', needsIngest: false },
  open: { id: 'open', label: 'Open next links', needsIngest: false },
  import: { id: 'import', label: 'Import', needsIngest: false },
  build: { id: 'build', label: 'Build', needsIngest: false },
  upload: { id: 'upload', label: 'Upload images', needsIngest: true },
  schema: { id: 'schema', label: 'Check schema', needsIngest: true },
  'dry-run': { id: 'dry-run', label: 'Dry run', needsIngest: true },
  verify: { id: 'verify', label: 'Verify', needsIngest: true },
  batch: { id: 'batch', label: 'Run batch', needsIngest: true },
  load: { id: 'load', label: 'Load into ingest', needsIngest: true },
};

// The steps, in order; the first failure stops them
export function stepsFor(id: ActionId, count: number): Step[] {
  const { status, build, upload, dryRun, apply, verify } = STEPS;
  switch (id) {
    case 'status':
      return [status];
    case 'open':
      return [uv('extract.links', 'open', 'general', '--count', String(count))];
    case 'import':
      return [STEPS.import, status];
    case 'build':
      return [build, status];
    case 'upload':
      return [upload, status];
    case 'schema':
      return [STEPS.schema];
    case 'dry-run':
      return [dryRun];
    case 'verify':
      return [verify];
    case 'batch':
      return [STEPS.import, status, build, upload, dryRun];
    case 'load':
      return [apply, verify, status];
  }
}

// Actions whose last step is the dry run
export const DRY_RUN_ACTIONS: readonly ActionId[] = ['dry-run', 'batch'];

const requestSchema = z.strictObject({
  count: z.int().min(OPEN_COUNT.min).max(OPEN_COUNT.max).optional(),
});

export type ActionRequest =
  | { success: true; id: ActionId; count: number }
  | { success: false; error: string };

export function parseActionRequest(id: string, body: unknown): ActionRequest {
  const action = ACTION_IDS.find((known) => known === id);
  if (!action) return { success: false, error: 'unknown action' };
  const parsed = requestSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return {
      success: false,
      error: `the body may hold only count, ${OPEN_COUNT.min}–${OPEN_COUNT.max}`,
    };
  }
  return {
    success: true,
    id: action,
    count: parsed.data.count ?? OPEN_COUNT.default,
  };
}
