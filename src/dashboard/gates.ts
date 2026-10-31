import { parseEnv } from 'node:util';
import { ACTION_IDS, ACTIONS, type ActionId } from '@/dashboard/actions.js';
import type { Running } from '@/dashboard/runner.js';
import { LOAD_TARGETS, type LoadTarget } from '@/config/env.schema.js';

export interface DryRun {
  at: string;
  manifestHash: string;
  // From "changes a load would make: N"
  changes: number | null;
  lines: string[];
}

export interface Gate {
  enabled: boolean;
  reason: string | null;
}

export interface GateInput {
  target: LoadTarget | null;
  running: Running | null;
  dryRun: DryRun | null;
  manifestHash: string | null;
}

const CHANGES = /^changes a load would make: (\d+)/;

export function dryRunChanges(lines: readonly string[]): number | null {
  for (const line of lines) {
    const match = CHANGES.exec(line);
    if (match) return Number(match[1]);
  }
  return null;
}

// As loadEnvFile: the shell wins over .env
export function targetFrom(
  shell: Readonly<Record<string, string | undefined>>,
  envText: string | null,
): LoadTarget | null {
  const value =
    shell.LOAD_TARGET ??
    (envText === null ? undefined : parseEnv(envText).LOAD_TARGET) ??
    'ingest';
  return LOAD_TARGETS.find((target) => target === value) ?? null;
}

function loadGate(input: GateInput): Gate {
  const { dryRun } = input;
  if (!dryRun) return { enabled: false, reason: 'Run a dry run first' };
  if (dryRun.manifestHash !== input.manifestHash) {
    return {
      enabled: false,
      reason: 'The dataset changed since the dry run: run it again',
    };
  }
  if (dryRun.changes === 0) {
    return { enabled: false, reason: 'The dry run found nothing to load' };
  }
  return { enabled: true, reason: null };
}

function gateOf(id: ActionId, input: GateInput): Gate {
  if (input.running) {
    return { enabled: false, reason: `${input.running.label} is running` };
  }
  if (ACTIONS[id].needsIngest && input.target !== 'ingest') {
    return {
      enabled: false,
      reason:
        input.target === null
          ? '.env has no valid LOAD_TARGET'
          : `LOAD_TARGET is ${input.target}: the dashboard acts on ingest only`,
    };
  }
  return id === 'load' ? loadGate(input) : { enabled: true, reason: null };
}

export function gatesOf(input: GateInput): Record<ActionId, Gate> {
  return Object.fromEntries(
    ACTION_IDS.map((id) => [id, gateOf(id, input)]),
  ) as Record<ActionId, Gate>;
}
