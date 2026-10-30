import { z } from 'zod';

export const LOG_KINDS = [
  'fixture',
  'match',
  'player',
  'crest',
  'photo',
] as const;
export const LOG_RESULTS = ['imported', 'duplicate', 'refused'] as const;

// extract/import_log.py's LogLine
export const logLineSchema = z.object({
  at: z.iso.datetime(),
  file: z.string().min(1),
  url: z.string().nullable(),
  kind: z.enum(LOG_KINDS).nullable(),
  key: z.string().nullable(),
  result: z.enum(LOG_RESULTS),
  reason: z.string().nullable(),
  records: z.int().min(0),
  backfilled: z.boolean(),
});
export type LogLine = z.infer<typeof logLineSchema>;

export type LogResult =
  { success: true; lines: LogLine[] } | { success: false; error: string };

export const HISTORY_PAGE = 100;

export interface HistoryFilter {
  kind?: string;
  result?: string;
  // YYYY-MM-DD, both ends included
  from?: string;
  to?: string;
  page?: number;
}

export interface HistoryView {
  total: number;
  page: number;
  pages: number;
  perDay: { day: string; count: number }[];
  lines: LogLine[];
}

export function parseLog(text: string): LogResult {
  const lines: LogLine[] = [];
  for (const [at, raw] of text.split('\n').entries()) {
    if (!raw.trim()) continue;
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return { success: false, error: `import log line ${at + 1}: not JSON` };
    }
    const parsed = logLineSchema.safeParse(json);
    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path.join('.') ?? '';
      return {
        success: false,
        error: `import log line ${at + 1}: invalid ${field || 'line'}`,
      };
    }
    lines.push(parsed.data);
  }
  return { success: true, lines };
}

function matches(line: LogLine, filter: HistoryFilter): boolean {
  const day = line.at.slice(0, 10);
  return (
    (!filter.kind || line.kind === filter.kind) &&
    (!filter.result || line.result === filter.result) &&
    (!filter.from || day >= filter.from) &&
    (!filter.to || day <= filter.to)
  );
}

// Newest first; the log is appended in time order
export function historyView(
  lines: readonly LogLine[],
  filter: HistoryFilter = {},
): HistoryView {
  const kept = lines.filter((line) => matches(line, filter)).toReversed();
  const days = new Map<string, number>();
  for (const line of kept) {
    const day = line.at.slice(0, 10);
    days.set(day, (days.get(day) ?? 0) + 1);
  }
  const pages = Math.max(1, Math.ceil(kept.length / HISTORY_PAGE));
  const page = Math.min(Math.max(1, filter.page ?? 1), pages);
  return {
    total: kept.length,
    page,
    pages,
    perDay: [...days].map(([day, count]) => ({ day, count })),
    lines: kept.slice((page - 1) * HISTORY_PAGE, page * HISTORY_PAGE),
  };
}
