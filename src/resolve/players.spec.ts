import {
  birthYear,
  displayName,
  resolvePlayers,
  sightings,
} from '@/resolve/players.js';
import type { TransfermarktMatch } from '@/raw/transfermarkt-match.js';
import type { TransfermarktPlayer } from '@/raw/transfermarkt-player.js';

const ENVELOPE = {
  source: 'transfermarkt',
  sourceUrl: 'https://www.transfermarkt.com/x',
  fetchedAt: '2026-10-27T00:00:00Z',
} as const;

function profile(
  id: string,
  headline: string,
  dateOfBirth: string | null = null,
) {
  const page: TransfermarktPlayer = {
    ...ENVELOPE,
    sourceId: id,
    headline,
    dateOfBirth,
    citizenship: null,
    position: null,
    fullName: null,
    nameInHomeCountry: null,
    capsGoals: null,
    imageUrl: null,
  };
  return [id, page] as const;
}

function starter(id: string, name: string) {
  return {
    sourceId: id,
    name,
    profilePath: `/p/profil/spieler/${id}`,
    shirtNumber: null,
    style: 'top: 80%; left: 40%;',
    isCaptain: false,
  };
}

function report(): TransfermarktMatch {
  return {
    ...ENVELOPE,
    sourceId: '990248',
    round: 'Final',
    date: '2001-05-23',
    result: '5:4',
    resultNote: 'on pens',
    shootout: [],
    home: {
      sourceId: '27',
      name: 'FC Bayern Munich',
      crestUrl: null,
      tablePosition: null,
      formation: null,
      starters: [
        starter('1', 'Kily Gonzá.'),
        starter('2', 'R. Ronaldo'),
        starter('3', 'Ronaldo'),
      ],
      bench: [
        {
          sourceId: '4',
          name: 'Bench Player',
          shirtNumber: null,
          position: null,
        },
      ],
    },
    away: {
      sourceId: '1049',
      name: 'Valencia CF',
      crestUrl: null,
      tablePosition: null,
      formation: null,
      starters: [starter('5', 'Çağlar')],
      bench: [],
    },
    events: [
      {
        box: 'goal',
        side: 'home',
        clock: null,
        addedTime: null,
        players: [
          { sourceId: '4', name: 'B. Player' },
          { sourceId: '1', name: 'Kily González' },
        ],
        text: '1:0',
      },
    ],
  };
}

describe('player names', () => {
  it('strips the shirt number and keeps diacritics', () => {
    expect(displayName('#11 Raphinha')).toBe('Raphinha');
    expect(displayName('Çağlar Söyüncü')).toBe('Çağlar Söyüncü');
    expect(displayName('#9')).toBe('');
  });

  it('reads the birth year from the profile date', () => {
    expect(birthYear('14/12/1996 (29)')).toBe('1996');
    expect(birthYear(null)).toBeNull();
    expect(birthYear('unknown')).toBeNull();
  });

  it('collects starters, bench and event players', () => {
    const seen = sightings(report());
    expect(seen.filter((s) => s.isStarter).map((s) => s.id)).toEqual([
      '1',
      '2',
      '3',
      '5',
    ]);
    expect(seen.filter((s) => !s.isStarter).map((s) => s.id)).toEqual([
      '4',
      '4',
      '1',
    ]);
  });
});

describe('resolvePlayers', () => {
  it('gives a slug only to players with a saved page; starters without one wait', () => {
    const result = resolvePlayers(
      [report()],
      new Map([profile('5', '#4 Çağlar Söyüncü')]),
      {},
    );

    expect(result.players).toEqual([
      {
        aliasCandidates: ['Çağlar'],
        name: 'Çağlar Söyüncü',
        slug: 'caglar-soyuncu',
        transfermarktId: '5',
      },
    ]);
    expect(result.waiting).toEqual(['1', '2', '3']);
  });

  it('keeps every other name as an alias candidate, never as the name', () => {
    const result = resolvePlayers(
      [report()],
      new Map([profile('1', '#18 Kily González')]),
      {},
    );
    expect(result.players[0]).toMatchObject({
      name: 'Kily González',
      aliasCandidates: ['Kily Gonzá.'],
    });
  });

  it('gives a substitute with a page a slug, though only starters wait', () => {
    const result = resolvePlayers(
      [report()],
      new Map([profile('4', 'Bench Player')]),
      {},
    );
    expect(result.players.map((p) => p.slug)).toEqual(['bench-player']);
    expect(result.waiting).not.toContain('4');
  });

  it('resolves a clash by birth year, then by id', () => {
    const pages = new Map([
      profile('2', '#9 Ronaldo', '18/09/1976 (50)'),
      profile('3', '#7 Ronaldo', '05/02/1985 (41)'),
      profile('5', 'Ronaldo', '05/02/1985 (41)'),
    ]);
    const result = resolvePlayers([report()], pages, {});

    expect(result.crosswalk).toEqual({
      '2': 'ronaldo',
      '3': 'ronaldo-1985',
      '5': 'ronaldo-5',
    });
    expect(result.clashes).toEqual(['3 → ronaldo-1985', '5 → ronaldo-5']);
  });

  it('never changes a slug the crosswalk already has', () => {
    const pages = new Map([profile('1', 'Kily González')]);
    const result = resolvePlayers([report()], pages, {
      '1': 'kily-gonzalez-1974',
    });
    expect(result.players[0]?.slug).toBe('kily-gonzalez-1974');
    expect(result.added).toEqual({});
  });

  it('ignores a saved page of a player in no pool match', () => {
    const result = resolvePlayers(
      [report()],
      new Map([profile('411295', '#11 Raphinha')]),
      {},
    );
    expect(result.players).toEqual([]);
    expect(result.crosswalk).toEqual({});
  });

  it('reports a page whose name gives no slug, and keeps the starter off the waiting list', () => {
    const pages = new Map([profile('2', '#9'), profile('3', 'Роналдо')]);
    const result = resolvePlayers([report()], pages, {});

    expect(result.unslugged).toEqual([
      { key: '2', reason: 'name has no Latin letters' },
      { key: '3', reason: 'name has no Latin letters' },
    ]);
    expect(result.players).toEqual([]);
    expect(result.waiting).toEqual(['1', '5']);
  });

  it("collects one player's names across several pool matches", () => {
    const second = { ...report(), sourceId: '990249' };
    second.home = { ...second.home, starters: [starter('1', 'K. González')] };
    const result = resolvePlayers(
      [report(), second],
      new Map([profile('1', 'Kily González')]),
      {},
    );
    expect(result.players[0]?.aliasCandidates).toEqual([
      'K. González',
      'Kily Gonzá.',
    ]);
  });

  it('is deterministic for the same input in any order', () => {
    const pages = [
      profile('5', 'Çağlar Söyüncü'),
      profile('1', 'Kily González'),
    ];
    const a = resolvePlayers([report()], new Map(pages), {});
    const b = resolvePlayers([report()], new Map(pages.toReversed()), {});
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
});
