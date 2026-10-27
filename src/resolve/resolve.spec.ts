import type { PoolMatch } from '@/pool/build.js';
import { CONFIG } from '@/pool/spec-fixtures.js';
import type { StageNames } from '@/resolve/curation.js';
import { renderReport } from '@/resolve/report.js';
import {
  resolve,
  resolvedMatchSchema,
  type ResolveInput,
} from '@/resolve/resolve.js';

const STAGES: StageNames = {
  stages: { FI: 'Final', QF: 'Quarter-final' },
  rounds: [{ pattern: '^([0-9]+)\\.Matchday$', text: 'Matchday $1' }],
};

function match(sourceId: string, extra: Partial<PoolMatch>): PoolMatch {
  return {
    away: '141',
    competitionCode: 'TR1',
    date: '2002-11-06',
    groups: ['derbies'],
    home: '36',
    result: null,
    round: '6.Matchday',
    seasonId: '2002',
    sourceId,
    stage: null,
    ...extra,
  };
}

const DERBY = match('1118844', {});
const FINAL = match('53491', {
  competitionCode: 'FIWC',
  home: '3376',
  away: '3377',
  seasonId: '2005',
  date: '2006-07-09',
  round: 'Knockout stage',
  stage: 'FI',
  groups: ['world-cup-knockouts'],
});

function input(
  matches: PoolMatch[],
  extra: Partial<ResolveInput> = {},
): ResolveInput {
  return {
    config: CONFIG,
    matches,
    names: new Map([
      ['36', new Map([['Fenerbahce', 34]])],
      ['141', new Map([['Galatasaray', 55]])],
      ['3376', new Map([['Italy', 10]])],
      ['3377', new Map([['France', 11]])],
    ]),
    clubNames: { '36': { name: 'Fenerbahçe', shortName: 'FEN' } },
    stageNames: STAGES,
    crosswalks: { competitions: {}, clubs: {}, matches: {} },
    ...extra,
  };
}

describe('resolve', () => {
  it('gives the derby its slug, season and stage text', () => {
    const resolved = resolve(input([DERBY, FINAL]));

    expect(resolved.matches.map((m) => m.slug)).toEqual([
      '2002-11-06-fenerbahce-galatasaray',
      '2006-07-09-italy-france',
    ]);
    expect(resolved.matches[0]).toEqual({
      away: 'galatasaray',
      competition: 'super-lig',
      date: '2002-11-06',
      groups: ['derbies'],
      home: 'fenerbahce',
      season: '2002-03',
      slug: '2002-11-06-fenerbahce-galatasaray',
      stage: 'Matchday 6',
      transfermarktId: '1118844',
    });
    expect(resolved.seasons).toEqual([
      { competition: 'super-lig', label: '2002-03', startYear: 2002 },
      { competition: 'world-cup', label: '2006', startYear: 2006 },
    ]);
  });

  it('sets club kind, display name, aliases and codes', () => {
    const { clubs, defaultShortNames } = resolve(input([DERBY, FINAL]));

    expect(clubs.find((c) => c.slug === 'fenerbahce')).toEqual({
      aliases: ['Fenerbahce'],
      kind: 'club',
      name: 'Fenerbahçe',
      shortName: 'FEN',
      slug: 'fenerbahce',
      transfermarktId: '36',
    });
    expect(clubs.find((c) => c.slug === 'italy')?.kind).toBe('national_team');
    expect(defaultShortNames).toEqual([
      'france: FRA',
      'galatasaray: GAL',
      'italy: ITA',
    ]);
  });

  it('keeps a committed slug when the display name changes later', () => {
    const first = resolve(input([DERBY]));
    const renamed = resolve(
      input([DERBY], {
        crosswalks: first.crosswalks,
        clubNames: { '36': { name: 'Fenerbahçe SK' } },
      }),
    );

    expect(renamed.crosswalks).toEqual(first.crosswalks);
    expect(renamed.matches[0]?.home).toBe('fenerbahce');
    expect(
      Object.values(renamed.added).every((w) => Object.keys(w).length === 0),
    ).toBe(true);
  });

  it('holds back a match outside its season, without a date, or in no competition', () => {
    const held = resolve(
      input([
        match('1', { date: '2003-08-01' }),
        match('2', { date: null }),
        match('3', { competitionCode: 'TR2' }),
      ]),
    ).held;

    expect(held).toEqual([
      { id: '3', reason: 'competition is not in pool.json' },
      { id: '1', reason: 'Date is outside the season' },
      { id: '2', reason: 'no date or season on the listing page' },
    ]);
  });

  it('accepts the 2019-20 Champions League final in August', () => {
    const late = match('3401234', {
      competitionCode: 'CL',
      seasonId: '2019',
      date: '2020-08-23',
      stage: 'FI',
      round: 'Knockout stage',
    });
    expect(resolve(input([late])).matches[0]?.season).toBe('2019-20');
  });

  it('reports stage text it cannot map and leaves it null', () => {
    const resolved = resolve(
      input([match('4', { stage: 'PO', round: 'Knockout stage' })]),
    );
    expect(resolved.matches[0]?.stage).toBeNull();
    expect(resolved.unmappedStages).toEqual([{ id: '4', reason: 'PO' }]);
  });

  it('is deterministic for the same input in any order', () => {
    const a = resolve(input([DERBY, FINAL]));
    const b = resolve(input([FINAL, DERBY]));
    expect(JSON.stringify(b.matches)).toBe(JSON.stringify(a.matches));
    expect(JSON.stringify(b.clubs)).toBe(JSON.stringify(a.clubs));
    expect(JSON.stringify(b.crosswalks)).toBe(JSON.stringify(a.crosswalks));
  });

  it('writes matches the next stage can read back', () => {
    const { matches } = resolve(input([DERBY, FINAL]));
    const written: unknown = JSON.parse(JSON.stringify(matches));

    expect(resolvedMatchSchema.array().parse(written)).toEqual(matches);
  });

  it('suffixes the second of two clubs with one display name', () => {
    const other = match('5', { home: '999', away: '141', date: '2002-12-01' });
    const resolved = resolve(
      input([DERBY, other], {
        clubNames: {
          '36': { name: 'Fenerbahçe' },
          '999': { name: 'Fenerbahçe' },
        },
      }),
    );
    expect(resolved.crosswalks.clubs).toMatchObject({
      '36': 'fenerbahce',
      '999': 'fenerbahce-999',
    });
  });

  it('leaves a club with no name seen unslugged and holds its match back', () => {
    const resolved = resolve(input([match('6', { home: '777' })]));
    expect(resolved.unslugged).toEqual([
      { entity: 'club', key: '777', reason: 'no name seen' },
    ]);
    expect(resolved.held).toEqual([
      { id: '6', reason: 'a competition or club has no slug' },
    ]);
  });

  it('reports held-back matches and missing slugs', () => {
    const report = renderReport(
      resolve(
        input([
          match('6', { home: '777' }),
          match('7', { date: '2003-08-01' }),
        ]),
      ),
    );
    expect(report).toContain('## Held back');
    expect(report).toContain('`7`: Date is outside the season');
    expect(report).toContain('club `777`: no name seen');
  });

  it('lists the player section when players are given', () => {
    const report = renderReport(resolve(input([DERBY])), {
      players: [],
      crosswalk: {},
      added: { '411295': 'raphinha' },
      waiting: ['7603'],
      clashes: [],
      unslugged: [],
    });
    expect(report).toContain('players `411295` → `raphinha`');
    expect(report).toContain('Starters waiting for a player page: 1.');
    expect(report).toContain('- `7603`');
  });

  it('reports ids and slugs only', () => {
    const report = renderReport(
      resolve(input([DERBY, match('4', { stage: 'PO' })])),
    );
    expect(report).toContain('clubs `36` → `fenerbahce`');
    expect(report).toContain('`4`: `PO`');
    expect(report).not.toMatch(/Fenerbahçe|Galatasaray /);
  });
});
