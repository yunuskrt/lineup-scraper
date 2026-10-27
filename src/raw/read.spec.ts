import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { latest, readRecords } from '@/raw/read.js';

const recordSchema = z.strictObject({
  sourceId: z.string(),
  fetchedAt: z.string(),
});

describe('readRecords', () => {
  let rawDir: string;

  beforeEach(() => {
    rawDir = mkdtempSync(path.join(tmpdir(), 'raw-'));
    mkdirSync(path.join(rawDir, 'match'));
  });

  afterEach(() => rmSync(rawDir, { recursive: true, force: true }));

  function save(file: string, lines: string[]): void {
    writeFileSync(path.join(rawDir, 'match', file), `${lines.join('\n')}\n`);
  }

  it('reads every partition in name order, skipping blank lines', () => {
    save('b.ndjson', ['{"sourceId":"2","fetchedAt":"t"}']);
    save('a.ndjson', ['{"sourceId":"1","fetchedAt":"t"}', '']);
    save('notes.txt', ['ignored']);

    expect(
      readRecords('match', recordSchema, rawDir).map((r) => r.sourceId),
    ).toEqual(['1', '2']);
    expect(readRecords('player', recordSchema, rawDir)).toEqual([]);
  });

  it('names the file and line and says to reparse, never the record', () => {
    save('inbox.ndjson', [
      '{"sourceId":"1","fetchedAt":"t"}',
      '{"sourceId":"Secret Name"}',
    ]);

    expect(() => readRecords('match', recordSchema, rawDir)).toThrow(
      'Invalid match record: match/inbox.ndjson:2. After a parser change, run `uv run python -m extract.inbox --reparse`',
    );
    save('inbox.ndjson', ['{broken']);
    expect(() => readRecords('match', recordSchema, rawDir)).toThrow(
      'Invalid JSON in match records: match/inbox.ndjson:1',
    );
  });
});

describe('latest', () => {
  it('keeps the newest saved copy of each page, the first on a tie', () => {
    const kept = latest([
      { sourceId: '1', fetchedAt: '2026-10-26T00:00:00Z', copy: 'old' },
      { sourceId: '1', fetchedAt: '2026-10-27T00:00:00Z', copy: 'new' },
      { sourceId: '2', fetchedAt: '2026-10-27T00:00:00Z', copy: 'first' },
      { sourceId: '2', fetchedAt: '2026-10-27T00:00:00Z', copy: 'second' },
    ]);

    expect([...kept.values()].map((r) => r.copy)).toEqual(['new', 'first']);
  });
});
