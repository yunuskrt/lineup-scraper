import {
  HISTORY_PAGE,
  historyView,
  parseLog,
  type LogLine,
} from '@/dashboard/history.js';

export function logLine(extra: Partial<LogLine> = {}): LogLine {
  return {
    at: '2026-10-30T10:00:00Z',
    file: 'match-1.html',
    url: null,
    kind: 'match',
    key: '1',
    result: 'imported',
    reason: null,
    records: 1,
    backfilled: false,
    ...extra,
  };
}

describe('parseLog', () => {
  it('reads one line per import and skips blank lines', () => {
    const text = `${JSON.stringify(logLine())}\n\n${JSON.stringify(logLine({ kind: null, key: null }))}\n`;
    const parsed = parseLog(text);
    expect(parsed.success && parsed.lines.map((l) => l.kind)).toEqual([
      'match',
      null,
    ]);
  });

  it('names the line and the field, never the value', () => {
    const bad = JSON.stringify({ ...logLine(), result: 'maybe' });
    expect(parseLog(`${JSON.stringify(logLine())}\n${bad}\n`)).toEqual({
      success: false,
      error: 'import log line 2: invalid result',
    });
    expect(parseLog('{nope')).toEqual({
      success: false,
      error: 'import log line 1: not JSON',
    });
  });
});

describe('historyView', () => {
  const lines = [
    logLine({ at: '2026-10-29T09:00:00Z', file: 'a.html' }),
    logLine({ at: '2026-10-30T09:00:00Z', file: 'b.html', kind: 'player' }),
    logLine({ at: '2026-10-30T10:00:00Z', file: 'c.html', result: 'refused' }),
  ];

  it('lists newest first, with a count per day', () => {
    const view = historyView(lines);
    expect(view.lines.map((l) => l.file)).toEqual([
      'c.html',
      'b.html',
      'a.html',
    ]);
    expect(view.perDay).toEqual([
      { day: '2026-10-30', count: 2 },
      { day: '2026-10-29', count: 1 },
    ]);
  });

  it('filters by kind, result and dates', () => {
    expect(historyView(lines, { kind: 'player' }).total).toBe(1);
    expect(historyView(lines, { result: 'refused' }).lines[0]?.file).toBe(
      'c.html',
    );
    expect(historyView(lines, { from: '2026-10-30' }).total).toBe(2);
    expect(historyView(lines, { to: '2026-10-29' }).total).toBe(1);
  });

  it('pages by 100 and clamps the page', () => {
    const many = Array.from({ length: HISTORY_PAGE + 5 }, (_, i) =>
      logLine({ file: `${i}.html` }),
    );
    const last = historyView(many, { page: 9 });
    expect([last.page, last.pages, last.lines.length]).toEqual([2, 2, 5]);
  });
});
