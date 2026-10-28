import { PLAYER_CHUNK, planChunks } from '@/load/chunks.js';
import { planLoad } from '@/load/plan.js';
import type { ContentRows, MatchRow } from '@/load/rows.js';

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

function match(slug: string, competition: string, season: string): MatchRow {
  return {
    slug,
    competition,
    season,
    date: '2002-11-06',
    stage: null,
    nickname: null,
    extraTime: false,
    shootoutHome: null,
    shootoutAway: null,
    transfermarktId: null,
  };
}

function wanted(players: number): ContentRows {
  const matches = [
    match('b', 'super-lig', '2002-03'),
    match('a', 'champions-league', '2000-01'),
    match('c', 'super-lig', '2002-03'),
  ];
  return {
    ...EMPTY,
    competitions: [{ slug: 'super-lig', kind: 'league', name: 'Süper Lig' }],
    players: Array.from({ length: players }, (_, i) => ({
      slug: `p-${String(i).padStart(4, '0')}`,
      name: `Player ${i}`,
      imageKey: null,
      transfermarktId: null,
    })),
    matches,
    matchEvents: matches.map((m) => ({
      match: m.slug,
      kind: 'goal',
      minute: 9,
      addedTime: null,
      side: 'home',
      player: null,
    })),
  };
}

const NOTHING = { rows: EMPTY, retirable: [], sessions: new Map() };

describe('planChunks', () => {
  it('orders parents, players by 500, each season, then retirements', () => {
    const rows = wanted(PLAYER_CHUNK * 2 + 1);
    const chunks = planChunks(
      planLoad(rows, { ...NOTHING, retirable: ['gone'] }),
      rows,
    );
    expect(chunks.map((c) => c.name)).toEqual([
      'competitions, seasons and clubs',
      'players 1–500',
      'players 501–1000',
      'players 1001–1001',
      'champions-league/2000-01',
      'super-lig/2002-03',
      'retirements',
    ]);
    expect(chunks.at(-1)?.retired).toEqual(['gone']);
  });

  it('keeps each season’s rows in its own chunk', () => {
    const rows = wanted(0);
    const chunks = planChunks(planLoad(rows, NOTHING), rows);
    const turkish = chunks.find((c) => c.name === 'super-lig/2002-03');
    expect(turkish?.tables.matches?.create.map((m) => m.slug)).toEqual([
      'b',
      'c',
    ]);
    expect(turkish?.tables.matchEvents?.create).toHaveLength(2);
    expect(turkish?.tables.players).toBeUndefined();
  });

  it('puts a player’s aliases in that player’s chunk', () => {
    const rows = wanted(PLAYER_CHUNK + 1);
    rows.playerAliases = [
      {
        player: `p-${String(PLAYER_CHUNK).padStart(4, '0')}`,
        alias: 'Last',
        normalized: 'last',
      },
    ];
    const chunks = planChunks(planLoad(rows, NOTHING), rows);
    const second = chunks.find((c) => c.name.startsWith('players 501'));
    expect(second?.tables.playerAliases?.create).toHaveLength(1);
    expect(second?.tables.players?.create).toHaveLength(1);
  });

  it('leaves out every chunk with nothing to write', () => {
    const rows = wanted(3);
    const stored = { ...NOTHING, rows };
    expect(planChunks(planLoad(rows, stored), rows)).toEqual([]);
  });
});
