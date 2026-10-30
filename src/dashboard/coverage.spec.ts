import { coverage } from '@/dashboard/coverage.js';
import { poolMatch } from '@/dashboard/spec-fixtures.js';
import { CONFIG } from '@/pool/spec-fixtures.js';

describe('coverage', () => {
  const league = Array.from({ length: 12 }, (_, i) =>
    poolMatch(String(100 + i), { home: '36', away: '141' }),
  );
  const cells = coverage(CONFIG, league, new Set(['100', '101']));
  const find = (kind: string, owner: string, period: string) =>
    cells.find(
      (c) => c.kind === kind && c.owner === owner && c.period === period,
    );

  it('counts ingested over the floor, with the pool beside it', () => {
    expect(find('leagueSeason', 'TR1', '2002-03')).toEqual({
      kind: 'leagueSeason',
      owner: 'TR1',
      period: '2002-03',
      floor: 10,
      pool: 12,
      ingested: 2,
      isBelow: true,
      isUnreachable: false,
    });
  });

  it("marks a cell whose pool can't reach its floor", () => {
    const club = find('clubEra', '36', '2000–07');
    expect(club).toMatchObject({ floor: 20, pool: 12, isUnreachable: true });
    expect(find('leagueSeason', 'TR1', '2010-11')).toMatchObject({
      pool: 0,
      isUnreachable: true,
    });
  });

  it('gives curated clubs with an id one cell per era', () => {
    const clubs = cells.filter((c) => c.kind === 'clubEra');
    expect(clubs.map((c) => c.owner)).toEqual([
      '141',
      '141',
      '141',
      '36',
      '36',
      '36',
      '114',
      '114',
      '114',
    ]);
  });

  it('gives tournaments one cell per edition, and the UEL none', () => {
    const wc = cells
      .filter((c) => c.kind === 'tournament')
      .map((c) => c.period);
    expect(wc).toEqual(['2002', '2006', '2010', '2014', '2018', '2022']);
    expect(cells.some((c) => c.owner === 'EL')).toBe(false);
    expect(cells.filter((c) => c.kind === 'uclSeason')).toHaveLength(26);
  });

  it('is at the floor once enough matches are ingested', () => {
    const all = new Set(league.map((m) => m.sourceId));
    const done = coverage(CONFIG, league, all).find(
      (c) => c.kind === 'leagueSeason' && c.period === '2002-03',
    );
    expect(done?.isBelow).toBe(false);
  });
});
