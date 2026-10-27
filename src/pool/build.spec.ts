import {
  buildPool,
  matchListSchema,
  parseFixtureLine,
  renderMatches,
} from '@/pool/build.js';
import { poolRules } from '@/pool/groups.js';
import { CONFIG, row } from '@/pool/spec-fixtures.js';
import { renderReport } from '@/pool/report.js';

const RULES = poolRules(CONFIG);
const derby = row('TR1', '36', '141', {
  sourceId: '1118844',
  result: '6:0',
  round: '6.Matchday',
});
const final = row('FIWC', '3376', '3377', {
  sourceId: '53491',
  seasonId: '2005',
  date: '2006-07-09',
  stage: 'FI',
});
const clash = row('TR1', '141', '114', {
  sourceId: '1118900',
  date: '2002-08-10',
});
const other = row('TR1', '141', '3205', { sourceId: '1118901' });

describe('buildPool', () => {
  it('keeps pool matches once, sorted by date then id, with raw fields', () => {
    const pool = buildPool([final, derby, other, clash, derby], RULES, [], []);

    expect(pool.matches.map((m) => m.sourceId)).toEqual([
      '1118900',
      '1118844',
      '53491',
    ]);
    expect(pool.matches[1]).toEqual({
      away: '141',
      competitionCode: 'TR1',
      date: '2002-11-06',
      groups: ['derbies'],
      home: '36',
      result: '6:0',
      round: '6.Matchday',
      seasonId: '2002',
      sourceId: '1118844',
      stage: null,
    });
    expect(pool.conflicts).toEqual([]);
  });

  it('reports two listing rows that disagree and leaves the match out', () => {
    const moved = { ...derby, date: '2002-11-07' };
    const pool = buildPool([derby, moved, final], RULES, [], []);

    expect(pool.matches.map((m) => m.sourceId)).toEqual(['53491']);
    expect(pool.conflicts).toEqual([{ sourceId: '1118844', fields: ['date'] }]);
  });

  it('reports a conflict even when only the second copy is in a group', () => {
    const notPool = { ...derby, away: { sourceId: '3205', name: 'K' } };
    const pool = buildPool([notPool, derby], RULES, [], []);

    expect(pool.matches).toEqual([]);
    expect(pool.conflicts).toEqual([{ sourceId: '1118844', fields: ['away'] }]);
  });

  it('adds an included match and drops an excluded one', () => {
    const pool = buildPool(
      [derby, final, other],
      RULES,
      [
        { sourceId: '1118901', note: 'famous comeback' },
        { sourceId: '999', note: 'not saved yet' },
      ],
      [{ sourceId: '53491', note: 'abandoned' }],
    );

    expect(pool.matches.map((m) => [m.sourceId, m.groups])).toEqual([
      ['1118844', ['derbies']],
      ['1118901', ['included']],
    ]);
    expect(pool.excluded).toEqual(['53491']);
    expect(pool.missingIncludes).toEqual(['999']);
  });

  it('puts an undated match last', () => {
    const undated = { ...clash, date: null };
    const pool = buildPool([undated, derby], RULES, [], []);
    expect(pool.matches.map((m) => m.sourceId)).toEqual(['1118844', '1118900']);
  });

  it('renders the same bytes for the same rows in any order', () => {
    const a = renderMatches(
      buildPool([derby, final, clash], RULES, [], []).matches,
    );
    const b = renderMatches(
      buildPool([clash, final, derby], RULES, [], []).matches,
    );
    expect(a).toBe(b);
    expect(a.endsWith(']\n')).toBe(true);
    expect(a).toContain('\n  {\n    "away": "141",');
  });
});

describe('parseFixtureLine', () => {
  it('reads a valid raw record', () => {
    expect(
      parseFixtureLine(JSON.stringify(derby), 'tr1-2002.ndjson:1'),
    ).toEqual(derby);
  });

  it('names the file and line, never the record, when a line is broken', () => {
    expect(() =>
      parseFixtureLine('{"sourceId": "1"', 'tr1-2002.ndjson:7'),
    ).toThrow('Invalid JSON in fixture records: tr1-2002.ndjson:7');
    const bad = JSON.stringify({
      ...derby,
      home: { sourceId: 'gs', name: 'Galatasaray' },
    });
    expect(() => parseFixtureLine(bad, 'tr1-2002.ndjson:8')).toThrow(
      /^Invalid fixture record: tr1-2002\.ndjson:8$/,
    );
  });
});

describe('matchListSchema', () => {
  it('needs a digit id and a note', () => {
    expect(
      matchListSchema.safeParse([{ sourceId: '1', note: 'why' }]).success,
    ).toBe(true);
    expect(
      matchListSchema.safeParse([{ sourceId: 'x', note: 'why' }]).success,
    ).toBe(false);
    expect(
      matchListSchema.safeParse([{ sourceId: '1', note: ' ' }]).success,
    ).toBe(false);
  });
});

describe('renderReport', () => {
  it('counts by group, competition and season and lists unsaved pages', () => {
    const moved = { ...derby, date: '2002-11-07' };
    const pool = buildPool([derby, moved, final, clash], RULES, [], []);

    const text = renderReport(pool, { total: 3, unsaved: ['gb1-2000'] });

    expect(text).toContain('Matches: 2. Conflicts: 1. Excluded: 0.');
    expect(text).toContain('| clashes | 1 |');
    expect(text).toContain('| FIWC 2005 | 1 |');
    expect(text).toContain('- `1118844`: date');
    expect(text).toContain('Saved: 2/3.');
    expect(text).toContain('- `gb1-2000`');
    expect(text).not.toMatch(/Galatasaray|Fenerbah/);
  });

  it('lists included ids that no saved listing page has', () => {
    const pool = buildPool(
      [derby],
      RULES,
      [{ sourceId: '999', note: 'later' }],
      [],
    );
    expect(renderReport(pool, null)).toContain(
      '## Included but not on a saved listing page\n\n- `999`',
    );
  });

  it('says how to make the listing list when it is missing', () => {
    const text = renderReport(buildPool([], RULES, [], []), null);
    expect(text).toContain('run `uv run python -m extract.lists.listings`');
  });
});
