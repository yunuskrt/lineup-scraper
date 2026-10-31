import type { Entry } from '@/dashboard/blocks.js';
import type { LogLine } from '@/dashboard/history.js';
import { isError, type LinkType } from '@/dashboard/links.js';
import type { RunResult } from '@/dashboard/runner.js';

export const FAILURE_SOURCES = [
  'row',
  'import',
  'inbox',
  'note',
  'run',
] as const;
export type FailureSource = (typeof FAILURE_SOURCES)[number];

export interface Failure {
  source: FailureSource;
  // A row number, an id or a file name
  ref: string;
  reason: string;
  todo: string;
}

export interface FailureInput {
  entries: readonly Entry[];
  log: readonly LogLine[];
  inbox: readonly string[];
  notes: readonly string[];
  // The last run of each dashboard action
  runs?: readonly RunResult[];
}

export const LOG_KIND: Record<LinkType, LogLine['kind']> = {
  Fixture: 'fixture',
  'Match Report': 'match',
  Player: 'player',
  Crest: 'crest',
  PlayerPhoto: 'photo',
};

// collection-runbook.md § Errors
export function todoFor(reason: string): string {
  if (reason.includes('challenge')) {
    return 'Save the page again once the site loads normally';
  }
  if (reason.startsWith('gate:')) {
    return 'Fix it in data/curation/ (enrichment-guide.md § 6), then build';
  }
  return 'Keep the page and ask for a fix; then run `uv run python -m extract.inbox --reparse --all`';
}

const RUN_IMPORT = 'Run `uv run python -m extract.inbox`';

// Latest per file, unless its page imported later
function refusals(log: readonly LogLine[]): LogLine[] {
  const latest = new Map<string, LogLine>();
  const imported = new Map<string, string>();
  for (const line of log) {
    latest.set(line.file, line);
    if (line.result === 'imported' && line.kind && line.key) {
      imported.set(`${line.kind}:${line.key}`, line.at);
    }
  }
  return [...latest.values()].filter((line) => {
    if (line.result !== 'refused') return false;
    const later = imported.get(`${line.kind}:${line.key}`);
    return later === undefined || later < line.at;
  });
}

export function failuresOf(input: FailureInput): Failure[] {
  const failures: Failure[] = [];
  const shown = new Set<string>();
  for (const entry of input.entries) {
    if (!isError(entry.status)) continue;
    const reason = entry.status.slice('error: '.length);
    shown.add(`${LOG_KIND[entry.type]}:${entry.key}`);
    failures.push({
      source: 'row',
      ref: `#${entry.index} ${entry.type} ${entry.key}`,
      reason,
      todo: todoFor(reason),
    });
  }
  // A refused file stays in the inbox until fixed
  const waiting = new Set(input.inbox);
  const refused = refusals(input.log).filter((line) => waiting.has(line.file));
  for (const line of refused) {
    if (shown.has(`${line.kind}:${line.key}`)) continue;
    const reason = line.reason ?? 'refused';
    failures.push({
      source: 'import',
      ref: line.file,
      reason,
      todo: todoFor(reason),
    });
  }
  const refusedFiles = new Set(refused.map((line) => line.file));
  for (const file of input.inbox) {
    if (refusedFiles.has(file)) continue;
    failures.push({
      source: 'inbox',
      ref: file,
      reason: 'waiting in data/inbox/',
      todo: RUN_IMPORT,
    });
  }
  for (const note of input.notes) {
    failures.push({
      source: 'note',
      ref: 'npm run status',
      reason: note,
      todo: 'Check `.env` (LOAD_TARGET, DATABASE_URL, the storage keys)',
    });
  }
  for (const run of input.runs ?? []) {
    if (run.exitCode === 0) continue;
    failures.push({
      source: 'run',
      ref: run.label,
      reason: `${run.failedStep ?? 'a step'} failed (exit ${run.exitCode})`,
      todo: 'Read its output under Actions; fix, then run it again',
    });
  }
  return failures;
}
