import { buildPool } from '@/pool/build.js';
import { poolRules } from '@/pool/groups.js';
import {
  LIST_LAYOUT_REASON,
  listLayoutIds,
  parseImportLog,
} from '@/pool/list-layout.js';
import { renderReport } from '@/pool/report.js';
import { CONFIG, row } from '@/pool/spec-fixtures.js';

const line = (key: string, result: string, reason: string | null = null) =>
  JSON.stringify({ kind: 'match', key, result, reason, file: `${key}.html` });

describe('listLayoutIds', () => {
  it('takes matches whose latest import refused a list layout', () => {
    const log = parseImportLog(
      [
        line('1', 'refused', LIST_LAYOUT_REASON),
        line(
          '2',
          'refused',
          'No home starters (div.formation-player-container)',
        ),
        line('3', 'refused', LIST_LAYOUT_REASON),
        line('3', 'imported'),
        line('4', 'refused', LIST_LAYOUT_REASON),
        line('4', 'duplicate'),
        '',
        JSON.stringify({
          kind: 'player',
          key: '5',
          result: 'refused',
          reason: LIST_LAYOUT_REASON,
        }),
      ].join('\n'),
    );
    expect([...listLayoutIds(log)].toSorted()).toEqual(['1', '4']);
  });

  it('names the line of a broken log, never its text', () => {
    expect(() =>
      parseImportLog(`${line('1', 'imported')}\n{"secret": `),
    ).toThrow(/^import log line 2: not JSON$/);
    expect(() => parseImportLog('{"kind": 1}')).toThrow(
      /^import log line 1: invalid$/,
    );
  });
});

describe('buildPool with list layouts', () => {
  const derby = row('TR1', '36', '141', { sourceId: '1118844' });
  const clash = row('TR1', '141', '114', {
    sourceId: '1118900',
    date: '2002-08-10',
  });

  it('leaves them out, sorted, and reports them', () => {
    const pool = buildPool(
      [derby, clash],
      poolRules(CONFIG),
      [],
      [],
      new Set(['1118844', '999']),
    );
    expect(pool.matches.map((m) => m.sourceId)).toEqual(['1118900']);
    expect(pool.listLayout).toEqual(['1118844']);
    const report = renderReport(pool, null);
    expect(report).toContain('List layout: 1.');
    expect(report).toContain('## Left out: list layout');
    expect(report).toContain('- `1118844`');
  });

  it('keeps everything without the set', () => {
    const pool = buildPool([derby, clash], poolRules(CONFIG), [], []);
    expect(pool.listLayout).toEqual([]);
    expect(renderReport(pool, null)).not.toContain('Left out');
  });
});
