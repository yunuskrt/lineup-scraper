import { planLoad, type StoredState } from '@/load/plan.js';
import type { ContentRows, LineupRow } from '@/load/rows.js';

const M = '2002-11-06-fenerbahce-galatasaray';

function lineup(side: 'home' | 'away', prefix: string): LineupRow[] {
  return Array.from({ length: 11 }, (_, slot) => ({
    match: M,
    side,
    slot,
    player: `${prefix}-${slot}`,
    position: slot === 0 ? 'GK' : 'DF',
  }));
}

function wanted(): ContentRows {
  return {
    competitions: [{ slug: 'super-lig', kind: 'league', name: 'Süper Lig' }],
    seasons: [{ competition: 'super-lig', label: '2002-03', startYear: 2002 }],
    clubs: [
      {
        slug: 'fenerbahce',
        kind: 'club',
        name: 'Fenerbahçe',
        shortName: 'FEN',
        crestKey: null,
        transfermarktId: '36',
      },
    ],
    clubAliases: [{ club: 'fenerbahce', alias: 'Fenerbahçe SK' }],
    players: [
      {
        slug: 'h-9',
        name: 'Serhat Akın',
        imageKey: null,
        transfermarktId: '2903',
      },
    ],
    playerAliases: [
      { player: 'h-9', alias: 'Serhat Akın', normalized: 'serhat akin' },
      { player: 'h-9', alias: 'Akın', normalized: 'akin' },
    ],
    matches: [
      {
        slug: M,
        competition: 'super-lig',
        season: '2002-03',
        date: '2002-11-06',
        stage: 'Matchday 12',
        nickname: null,
        extraTime: false,
        shootoutHome: null,
        shootoutAway: null,
        transfermarktId: '1118844',
      },
    ],
    matchTeams: [
      {
        match: M,
        side: 'home',
        club: 'fenerbahce',
        goals: 6,
        formation: '4-4-2',
      },
      {
        match: M,
        side: 'away',
        club: 'galatasaray',
        goals: 0,
        formation: '4-4-2',
      },
    ],
    lineups: [...lineup('home', 'h'), ...lineup('away', 'a')],
    matchEvents: [
      {
        match: M,
        kind: 'goal',
        minute: 9,
        addedTime: null,
        side: 'home',
        player: 'h-9',
      },
      {
        match: M,
        kind: 'red_card',
        minute: 84,
        addedTime: null,
        side: 'away',
        player: null,
      },
    ],
    memorabilityScores: [
      {
        match: M,
        score: 65,
        signals: '{"sides":{}}',
        algorithmVersion: 's10-v1',
        computedAt: '2026-10-27T14:57:30.000Z',
      },
    ],
  };
}

const EMPTY: ContentRows = {
  competitions: [],
  seasons: [],
  clubs: [],
  clubAliases: [],
  players: [],
  playerAliases: [],
  matches: [],
  matchTeams: [],
  lineups: [],
  matchEvents: [],
  memorabilityScores: [],
};

function stored(
  rows: ContentRows,
  over: Partial<StoredState> = {},
): StoredState {
  return { rows, retirable: [], sessions: new Map(), ...over };
}

function counts(rows: ContentRows, state: StoredState) {
  const plan = planLoad(rows, state);
  return Object.fromEntries(
    (
      ['playerAliases', 'lineups', 'matchEvents', 'memorabilityScores'] as const
    ).map((t) => [
      t,
      [
        plan[t].create.length,
        plan[t].update.length,
        plan[t].delete.length,
        plan[t].same,
      ],
    ]),
  );
}

describe('planLoad', () => {
  it('creates everything on an empty branch', () => {
    const plan = planLoad(wanted(), stored(EMPTY));
    expect(plan.players.create).toHaveLength(1);
    expect(plan.lineups.create).toHaveLength(22);
    expect(plan.matchEvents.create).toHaveLength(2);
    expect(plan.rewrittenSides).toEqual([]);
    expect(plan.retired).toEqual([]);
  });

  it('changes nothing when the branch already holds the dataset', () => {
    const plan = planLoad(wanted(), stored(wanted()));
    for (const table of [
      'competitions',
      'seasons',
      'clubs',
      'players',
      'matches',
    ] as const) {
      expect(plan[table]).toMatchObject({ create: [], update: [], delete: [] });
    }
    expect(plan.lineups.same).toBe(22);
    expect(plan.matchEvents.same).toBe(2);
  });

  it('updates a changed field, matched by natural key', () => {
    const held = wanted();
    held.players[0] = { ...held.players[0], transfermarktId: null };
    held.matches[0] = { ...held.matches[0], extraTime: true };
    const plan = planLoad(wanted(), stored(held));
    expect(plan.players.update.map((p) => p.slug)).toEqual(['h-9']);
    expect(plan.matches.update.map((m) => m.slug)).toEqual([M]);
  });

  it('creates, updates and deletes aliases to match the dataset', () => {
    const held = wanted();
    held.playerAliases = [
      { player: 'h-9', alias: 'Serhat Akin', normalized: 'serhat akin' },
      { player: 'h-9', alias: 'Serhat', normalized: 'serhat' },
    ];
    held.clubAliases = [{ club: 'fenerbahce', alias: 'Fener' }];
    const plan = planLoad(wanted(), stored(held));
    expect(plan.playerAliases.create.map((a) => a.normalized)).toEqual([
      'akin',
    ]);
    expect(plan.playerAliases.update.map((a) => a.alias)).toEqual([
      'Serhat Akın',
    ]);
    expect(plan.playerAliases.delete.map((a) => a.normalized)).toEqual([
      'serhat',
    ]);
    expect(plan.clubAliases.delete.map((a) => a.alias)).toEqual(['Fener']);
    expect(plan.clubAliases.create.map((a) => a.alias)).toEqual([
      'Fenerbahçe SK',
    ]);
  });

  it('rewrites a side whole when two slots swap, and only that side', () => {
    const held = wanted();
    const home = held.lineups.slice(0, 11);
    [home[3].player, home[4].player] = [home[4].player, home[3].player];
    const plan = planLoad(wanted(), stored(held));
    expect(plan.rewrittenSides).toEqual([`${M}|home`]);
    expect([
      plan.lineups.create.length,
      plan.lineups.delete.length,
      plan.lineups.same,
    ]).toEqual([11, 11, 11]);
  });

  it('replaces events whole when one is added, or all are removed', () => {
    const held = wanted();
    held.matchEvents = held.matchEvents.slice(0, 1);
    expect(counts(wanted(), stored(held)).matchEvents).toEqual([2, 0, 1, 0]);
    const none = { ...wanted(), matchEvents: [] };
    const plan = planLoad(none, stored(wanted()));
    expect(plan.matchEvents.delete).toHaveLength(2);
    expect(plan.replacedEvents).toEqual([M]);
  });

  it('ignores the order events are stored in', () => {
    const held = wanted();
    held.matchEvents.reverse();
    expect(counts(wanted(), stored(held)).matchEvents).toEqual([0, 0, 0, 2]);
  });

  it('updates a moved score and retires a match that left (D2)', () => {
    const held = wanted();
    held.memorabilityScores[0] = { ...held.memorabilityScores[0], score: 70 };
    held.memorabilityScores.push({
      ...held.memorabilityScores[0],
      match: 'gone',
    });
    const plan = planLoad(wanted(), stored(held, { retirable: ['gone'] }));
    expect(plan.memorabilityScores.update).toHaveLength(1);
    expect(plan.memorabilityScores.delete.map((s) => s.match)).toEqual([
      'gone',
    ]);
    expect(plan.retired).toEqual(['gone']);
    expect(plan.matches.delete).toEqual([]);
  });

  it('flags a played match whose XI changes or that retires (D3)', () => {
    const held = wanted();
    held.lineups[5] = { ...held.lineups[5], position: 'MF' };
    const sessions = new Map([
      [M, 4],
      ['gone', 1],
      ['quiet', 2],
    ]);
    const plan = planLoad(
      wanted(),
      stored(held, { retirable: ['gone'], sessions }),
    );
    expect(plan.played).toEqual([M, 'gone'].toSorted());
  });

  it('never deletes a competition, season, club, player or match', () => {
    const held = wanted();
    held.players.push({
      slug: 'old',
      name: 'Old',
      imageKey: null,
      transfermarktId: null,
    });
    held.clubs.push({
      ...held.clubs[0],
      slug: 'old-club',
      transfermarktId: null,
    });
    const plan = planLoad(wanted(), stored(held));
    for (const table of [
      'competitions',
      'seasons',
      'clubs',
      'players',
      'matches',
    ] as const) {
      expect(plan[table].delete).toEqual([]);
    }
  });
});
