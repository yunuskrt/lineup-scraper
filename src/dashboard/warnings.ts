import type { Entry } from '@/dashboard/blocks.js';
import { isError } from '@/dashboard/links.js';

export interface Warning {
  message: string;
  command: string;
}

export interface WarningInput {
  entries: readonly Entry[];
  inbox: number;
  // File modification times, in ms; null if missing
  csvAt: number | null;
  sourcesAt: readonly (number | null)[];
}

const IMAGE_TYPES = new Set(['Crest', 'PlayerPhoto']);
const PAGE_TYPES = new Set(['Match Report', 'Player']);

// Match ids whose report reached validated or later
function readyMatches(entries: readonly Entry[]): Set<string> {
  return new Set(
    entries
      .filter(
        (e) =>
          e.type === 'Match Report' &&
          (e.status === 'validated' || e.status === 'ingested'),
      )
      .map((e) => e.key),
  );
}

export function warningsOf(input: WarningInput): Warning[] {
  const { entries } = input;
  const warnings: Warning[] = [];
  const errors = entries.filter((e) => isError(e.status)).length;
  if (errors > 0) {
    warnings.push({
      message: `Rows at error: ${errors}`,
      command: 'See Failures',
    });
  }
  if (input.inbox > 0) {
    warnings.push({
      message: `Files waiting in data/inbox/: ${input.inbox}`,
      command: 'uv run python -m extract.inbox',
    });
  }
  const due = entries.filter(
    (e) => PAGE_TYPES.has(e.type) && e.status === 'validated',
  ).length;
  if (due > 0) {
    warnings.push({
      message: `Validated matches and players not ingested: ${due}`,
      command: 'npm run load, then npm run load -- --apply',
    });
  }
  const ready = readyMatches(entries);
  const notUploaded = entries.filter(
    (e) =>
      IMAGE_TYPES.has(e.type) &&
      e.status === 'saved' &&
      e.context.match !== null &&
      ready.has(e.context.match),
  ).length;
  if (notUploaded > 0) {
    warnings.push({
      message: `Images of validated matches not uploaded: ${notUploaded}`,
      command: 'npm run images -- --upload',
    });
  }
  const newest = Math.max(0, ...input.sourcesAt.map((at) => at ?? 0));
  if (input.csvAt === null || input.csvAt < newest) {
    warnings.push({
      message:
        input.csvAt === null
          ? 'general.csv is missing'
          : 'general.csv is older than the last import or build',
      command: 'npm run status',
    });
  }
  return warnings;
}
