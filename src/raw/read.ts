import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { z } from 'zod';
import { DATA_DIRS } from '@/config/data-dirs.js';

const RAW_DIR = path.join(DATA_DIRS.raw, 'transfermarkt');

export function ndjsonLines(
  kind: string,
  rawDir = RAW_DIR,
): { line: string; at: string }[] {
  const dir = path.join(rawDir, kind);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.ndjson'))
    .toSorted()
    .flatMap((file) =>
      readFileSync(path.join(dir, file), 'utf8')
        .split('\n')
        .map((line, i) => ({ line, at: `${kind}/${file}:${i + 1}` }))
        .filter(({ line }) => line.trim() !== ''),
    );
}

// Names the file and line, never the record
export function readRecords<T>(
  kind: string,
  schema: z.ZodType<T>,
  rawDir = RAW_DIR,
): T[] {
  return ndjsonLines(kind, rawDir).map(({ line, at }) => {
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      throw new Error(`Invalid JSON in ${kind} records: ${at}`);
    }
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      throw new Error(
        `Invalid ${kind} record: ${at}. After a parser change, run ` +
          '`uv run python -m extract.inbox --reparse`',
      );
    }
    return parsed.data;
  });
}

// The latest saved copy of each page
export function latest<T extends { sourceId: string; fetchedAt: string }>(
  records: T[],
): Map<string, T> {
  const byId = new Map<string, T>();
  for (const record of records) {
    const kept = byId.get(record.sourceId);
    if (!kept || record.fetchedAt > kept.fetchedAt)
      byId.set(record.sourceId, record);
  }
  return byId;
}
