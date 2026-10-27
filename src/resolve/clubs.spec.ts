import { clubDraft, commonName, defaultShortName } from '@/resolve/clubs.js';
import { seasonLabel } from '@/resolve/seasons.js';

describe('seasonLabel', () => {
  it.each([
    ['league', '2002', '2002-03'],
    ['ucl', '2009', '2009-10'],
    ['uel', '2025', '2025-26'],
    ['world_cup', '2005', '2006'],
    ['euro', '1999', '2000'],
  ])('%s %s → %s', (kind, seasonId, label) => {
    expect(seasonLabel(kind, seasonId)).toBe(label);
  });
});

describe('club names', () => {
  it('takes the name seen most often, a tie alphabetically', () => {
    expect(
      commonName(
        new Map([
          ['Inter', 1],
          ['Inter Milan', 3],
        ]),
      ),
    ).toBe('Inter Milan');
    expect(
      commonName(
        new Map([
          ['Beta', 2],
          ['Alpha', 2],
        ]),
      ),
    ).toBe('Alpha');
    expect(commonName(new Map())).toBeNull();
  });

  it('makes a default code from the first three letters', () => {
    expect(defaultShortName('Kayserispor')).toBe('KAY');
    expect(defaultShortName('Real Madrid')).toBe('REA');
    expect(defaultShortName('Beşiktaş JK')).toBe('BES');
  });

  it('prefers curation and keeps every other name as an alias', () => {
    const draft = clubDraft('27', false, new Map([['FC Bayern Munich', 30]]), {
      name: 'Bayern Munich',
      shortName: 'BAY',
    });
    expect(draft).toEqual({
      id: '27',
      kind: 'club',
      name: 'Bayern Munich',
      shortName: 'BAY',
      isDefaultShortName: false,
      aliases: ['FC Bayern Munich'],
    });
  });

  it('marks a national team and a default code', () => {
    const draft = clubDraft('3376', true, new Map([['Italy', 10]]), undefined);
    expect(draft).toMatchObject({
      kind: 'national_team',
      shortName: 'ITA',
      isDefaultShortName: true,
    });
    expect(draft?.aliases).toEqual([]);
  });
});
