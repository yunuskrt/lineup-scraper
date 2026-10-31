import {
  ACTIONS,
  DRY_RUN_ACTIONS,
  OPEN_COUNT,
  stepsFor,
  type ActionId,
} from '@/dashboard/actions.js';
import {
  dryRunChanges,
  gatesOf,
  type DryRun,
  type Gate,
} from '@/dashboard/gates.js';
import type {
  Runner,
  RunEvent,
  RunResult,
  Running,
} from '@/dashboard/runner.js';
import type { LoadTarget } from '@/config/env.schema.js';

export interface ControlDeps {
  runner: Runner;
  // Read fresh: .env may change while it runs
  target: () => LoadTarget | null;
  manifestHash: () => string | null;
  isDatasetDirty: () => boolean;
}

export interface ControlStatus {
  target: LoadTarget | null;
  running: Running | null;
  last: RunResult[];
  gates: Record<ActionId, Gate>;
  dryRun: DryRun | null;
  isDatasetDirty: boolean;
  openCount: typeof OPEN_COUNT;
}

export type StartOutcome =
  { success: true } | { success: false; status: 403 | 409; error: string };

export interface Control {
  status(): ControlStatus;
  start(id: ActionId, count: number): StartOutcome;
  lastRuns(): RunResult[];
  subscribe(listener: (event: RunEvent) => void): () => void;
}

export function createControl(deps: ControlDeps): Control {
  const { runner } = deps;
  // The last passed dry run, in this session only
  let dryRun: DryRun | null = null;

  const gates = () =>
    gatesOf({
      target: deps.target(),
      running: runner.running,
      dryRun,
      manifestHash: deps.manifestHash(),
    });

  function record(id: ActionId, result: RunResult): void {
    if (!DRY_RUN_ACTIONS.includes(id) || result.exitCode !== 0) return;
    dryRun = {
      at: result.endedAt,
      manifestHash: deps.manifestHash() ?? '',
      changes: dryRunChanges(result.lastStep.lines),
      lines: result.lastStep.lines,
    };
  }

  return {
    status: () => ({
      target: deps.target(),
      running: runner.running,
      last: runner.lastResults(),
      gates: gates(),
      dryRun,
      isDatasetDirty: deps.isDatasetDirty(),
      openCount: OPEN_COUNT,
    }),
    start(id, count) {
      const gate = gates()[id];
      if (!gate.enabled) {
        const status = runner.running ? 409 : 403;
        return { success: false, status, error: gate.reason ?? 'disabled' };
      }
      // A load uses its dry run up; any new one counts
      if (id === 'load' || DRY_RUN_ACTIONS.includes(id)) dryRun = null;
      const started = runner.start(id, ACTIONS[id].label, stepsFor(id, count));
      if (!started.success) {
        return { success: false, status: 409, error: started.error };
      }
      void started.done.then((result) => record(id, result));
      return { success: true };
    },
    lastRuns: () => runner.lastResults(),
    subscribe: (listener) => runner.subscribe(listener),
  };
}
