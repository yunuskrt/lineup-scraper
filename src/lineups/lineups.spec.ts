import {
  extractLineups,
  resultAgreement,
  type LineupsInput,
} from '@/lineups/lineups.js';
import { renderReport } from '@/lineups/report.js';
import { event, final2001 } from '@/lineups/spec-fixtures.js';
import type { PoolMatch } from '@/pool/build.js';
import type { ResolvedMatch } from '@/resolve/resolve.js';

const NAMES = { '4-4-2 Diamond': '4-1-2-1-2' };
const FINAL: ResolvedMatch = {
  away: 'valencia',
  competition: 'champions-league',
  date: '2001-05-23',
  groups: ['ucl-knockouts'],
  home: 'bayern-munich',
  season: '2000-01',
  slug: '2001-05-23-bayern-munich-valencia',
  stage: 'Final',
  transfermarktId: '990248',
};
const DERBY: ResolvedMatch = {
  ...FINAL,
  away: 'galatasaray',
  date: '2002-11-06',
  home: 'fenerbahce',
  slug: '2002-11-06-fenerbahce-galatasaray',
  transfermarktId: '1118844',
};
const FINAL_ROW: PoolMatch = {
  away: '1049',
  competitionCode: 'CL',
  date: '2001-05-23',
  groups: ['ucl-knockouts'],
  home: '27',
  result: '5:4 on pens',
  round: 'Knockout stage',
  seasonId: '2000',
  sourceId: '990248',
  stage: 'FI',
};

function input(overrides: Partial<LineupsInput> = {}): LineupsInput {
  return {
    matches: [FINAL, DERBY],
    pool: new Map([['990248', FINAL_ROW]]),
    reports: new Map([['990248', final2001()]]),
    formationNames: NAMES,
    ...overrides,
  };
}

describe('extractLineups', () => {
  it('reads the 2001 final and waits for the derby report', () => {
    const lineups = extractLineups(input());

    expect(lineups.waiting).toEqual(['2002-11-06-fenerbahce-galatasaray']);
    expect(lineups.held).toEqual([]);
    expect(lineups.sides).toEqual([]);
    const [match] = lineups.matches;
    expect(match).toMatchObject({
      extraTime: true,
      halfTime: { away: 1, home: 0 },
      shootout: { away: 4, home: 5 },
      slug: FINAL.slug,
      transfermarktId: '990248',
    });
    expect(match!.sides.home).toMatchObject({
      club: 'bayern-munich',
      formation: '5-4-1',
      goals: 1,
    });
    expect(match!.sides.away.formation).toBe('4-1-2-1-2');
    expect(match!.sides.away.starters).toHaveLength(11);
    expect(lineups.formations).toEqual([
      ['4-4-2 Diamond', 1],
      ['5-4-1', 1],
    ]);
    expect(lineups.unknownMinutes).toEqual([]);
  });

  it('holds back a report whose date or teams differ from the listing', () => {
    const date = extractLineups(
      input({
        reports: new Map([['990248', final2001({ date: '2001-05-24' })]]),
      }),
    );
    expect(date.held).toEqual([
      { slug: FINAL.slug, reason: 'the date differs from the listing' },
    ]);
    const swapped = { ...FINAL_ROW, home: '1049', away: '27' };
    const teams = extractLineups(
      input({ pool: new Map([['990248', swapped]]) }),
    );
    expect(teams.held[0]!.reason).toBe('the teams differ from the listing');
    expect(teams.matches).toEqual([]);
  });

  it('holds back a running score that jumps', () => {
    const report = final2001({
      events: [event('goal', 'home', null, '2:0 A', ['197'])],
    });
    const lineups = extractLineups(
      input({ reports: new Map([['990248', report]]) }),
    );
    expect(lineups.held[0]!.reason).toBe('the running score jumps');
  });

  it('keeps a side it cannot map, with no formation or slots, and says why', () => {
    // Without curation the diamond reads 4-4-2: two central midfielders
    const lineups = extractLineups(input({ formationNames: {} }));

    expect(lineups.sides).toEqual([
      {
        slug: FINAL.slug,
        reason: 'away: two starters share a left position in line 2',
      },
    ]);
    expect(lineups.matches[0]!.sides.away).toMatchObject({
      formation: null,
      starters: [],
    });
    const unread = extractLineups(
      input({
        reports: new Map([
          [
            '990248',
            final2001({
              away: { ...final2001().away, formation: 'Starting Line-up: ?' },
            }),
          ],
        ]),
      }),
    );
    expect(unread.sides[0]!.reason).toBe('away: formation `?` not read');
    expect(unread.matches[0]!.sides.away).toMatchObject({
      formation: null,
      starters: [],
    });
  });

  it('reports events with an unknown minute and keeps them', () => {
    const report = final2001({
      events: [event('goal', 'away', '-0px -433px', '0:1 A', ['7603'])],
      result: '0:1',
      resultNote: null,
      shootout: [],
    });
    const lineups = extractLineups(
      input({ reports: new Map([['990248', report]]) }),
    );
    expect(lineups.unknownMinutes).toEqual([
      { slug: FINAL.slug, reason: '1 event(s)' },
    ]);
    expect(lineups.matches[0]!.events[0]!.minute).toBeNull();
    expect(lineups.matches[0]!.halfTime).toBeNull();
  });

  it('gives the same output for the same input', () => {
    expect(JSON.stringify(extractLineups(input()))).toBe(
      JSON.stringify(extractLineups(input())),
    );
  });
});

describe('resultAgreement', () => {
  const goals = { away: 1, home: 1 };
  const shootout = { away: 4, home: 5 };

  it('tells a shootout-only result from score plus shootout', () => {
    const check = { slug: 's', goals, shootout };
    expect(resultAgreement({ ...check, fixture: '5:4 on pens' })).toBe(
      'shootout only',
    );
    expect(resultAgreement({ ...check, fixture: '6:5 on pens' })).toBe(
      'score plus shootout',
    );
    expect(resultAgreement({ ...check, fixture: '1:1' })).toBe('differs');
  });

  it('compares a plain result with the goals', () => {
    const check = { slug: 's', goals: { away: 0, home: 6 }, shootout: null };
    expect(resultAgreement({ ...check, fixture: '6:0' })).toBe('equal');
    expect(resultAgreement({ ...check, fixture: '6:1' })).toBe('differs');
    expect(resultAgreement({ ...check, fixture: null })).toBe(
      'no fixture result',
    );
  });
});

describe('renderReport', () => {
  it('names slugs and counts, never a player', () => {
    const report = renderReport(extractLineups(input()));

    expect(report).toContain(
      `\`${FINAL.slug}\`: fixture \`5:4 on pens\`, goals 1:1, shootout 5:4 → shootout only`,
    );
    expect(report).toContain('`2002-11-06-fenerbahce-galatasaray`');
    expect(report).toContain('`4-4-2 Diamond`: 1');
    expect(report).not.toMatch(/Player|7603/);
  });
});
