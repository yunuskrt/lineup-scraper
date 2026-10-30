import { toEntries } from '@/dashboard/blocks.js';
import { linkRow, poolMatch } from '@/dashboard/spec-fixtures.js';
import { CONFIG } from '@/pool/spec-fixtures.js';

describe('toEntries', () => {
  const matches = [
    poolMatch('1118844'),
    poolMatch('53491', {
      competitionCode: 'FIWC',
      seasonId: '2005',
      groups: ['world-cup-knockouts'],
      home: '3376',
      away: '3377',
    }),
  ];

  it('gives a listing its competition, season, era and groups', () => {
    const [fixture] = toEntries(
      [linkRow(1, 'Fixture', 'TR1-2002')],
      [],
      CONFIG,
    );
    expect(fixture?.context).toEqual({
      groups: ['derbies', 'clashes'],
      competition: 'TR1',
      season: '2002-03',
      era: 0,
      clubs: [],
      match: null,
    });
  });

  it('puts crest, player and photo rows under the match above', () => {
    const entries = toEntries(
      [
        linkRow(1, 'Match Report', '1118844'),
        linkRow(2, 'Crest', '36'),
        linkRow(3, 'Player', '206'),
        linkRow(4, 'Match Report', '53491'),
        linkRow(5, 'PlayerPhoto', '206'),
      ],
      matches,
      CONFIG,
    );
    expect(entries.map((e) => e.context.match)).toEqual([
      '1118844',
      '1118844',
      '1118844',
      '53491',
      '53491',
    ]);
    expect(entries[4]?.context).toEqual({
      groups: ['world-cup-knockouts'],
      competition: 'FIWC',
      season: '2006',
      era: 0,
      clubs: ['3376', '3377'],
      match: '53491',
    });
  });

  it('keeps a match not in the pool, with no context', () => {
    const [report, crest] = toEntries(
      [linkRow(1, 'Match Report', '9'), linkRow(2, 'Crest', '36')],
      matches,
      CONFIG,
    );
    expect(report?.context.match).toBe('9');
    expect(crest?.context.groups).toEqual([]);
  });
});
