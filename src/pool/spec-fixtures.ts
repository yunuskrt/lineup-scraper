import type { PoolConfig } from '@/pool/config.js';
import type { TransfermarktFixture } from '@/raw/transfermarkt-fixture.js';

// Hand-made config and rows for the pool specs
const LEAGUE = { linkStyle: 'league', isVerified: true, urlSlug: 'x' } as const;
const CUP = { linkStyle: 'cup', isVerified: true, urlSlug: 'x' } as const;
const SEASONS = { first: 2000, last: 2025, step: 1 };

export const CONFIG: PoolConfig = {
  competitions: [
    {
      ...LEAGUE,
      code: 'TR1',
      kind: 'league',
      name: 'Süper Lig',
      seasons: SEASONS,
      groups: ['derbies', 'clashes'],
    },
    {
      ...CUP,
      code: 'CL',
      kind: 'ucl',
      name: 'UCL',
      seasons: SEASONS,
      groups: ['ucl-knockouts', 'derbies'],
    },
    {
      ...CUP,
      code: 'EL',
      kind: 'uel',
      name: 'UEL',
      seasons: SEASONS,
      groups: ['uel-finals', 'derbies'],
    },
    {
      ...CUP,
      code: 'FIWC',
      kind: 'world_cup',
      name: 'World Cup',
      seasons: { first: 2001, last: 2021, step: 4 },
      groups: ['world-cup-knockouts'],
    },
  ],
  clubs: [
    { key: 'galatasaray', name: 'Galatasaray', league: 'TR1', id: '141' },
    { key: 'fenerbahce', name: 'Fenerbahçe', league: 'TR1', id: '36' },
    { key: 'besiktas', name: 'Beşiktaş', league: 'TR1', id: '114' },
    { key: 'trabzonspor', name: 'Trabzonspor', league: 'TR1', id: null },
  ],
  derbies: [
    { name: 'Kıtalar Arası Derbi', clubs: ['fenerbahce', 'galatasaray'] },
    { name: 'No id yet', clubs: ['besiktas', 'trabzonspor'] },
  ],
  knockoutStages: {
    'ucl-knockouts': ['QF', 'SF', 'FI'],
    'uel-finals': ['FI'],
    'world-cup-knockouts': ['Ro16', 'QF', 'SF', 'FI'],
  },
};

export function row(
  code: string,
  home: string,
  away: string,
  extra: Partial<TransfermarktFixture> = {},
): TransfermarktFixture {
  return {
    source: 'transfermarkt',
    sourceId: '1',
    sourceUrl: 'https://www.transfermarkt.com/x',
    fetchedAt: '2026-10-27T00:00:00Z',
    competitionCode: code,
    seasonId: '2002',
    round: null,
    stage: null,
    date: '2002-11-06',
    home: { sourceId: home, name: 'H' },
    away: { sourceId: away, name: 'A' },
    result: null,
    ...extra,
  };
}
