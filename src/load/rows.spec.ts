import type { DatasetInput } from '@/dataset/schema.js';
import { canonicalJson, isoInstant, wantedRows } from '@/load/rows.js';

type Match = DatasetInput['matches'][number];

const SIDES = {
  home: { guessability: 1, starPower: 0.55 },
  away: { guessability: 0.95, starPower: 0.42 },
};

function team(prefix: string): Match['home'] {
  return {
    formation: '4-4-2',
    lineup: [
      { playerSlug: `${prefix}-0`, slot: 0, position: 'GK' },
      { playerSlug: `${prefix}-1`, slot: 1, position: 'DF' },
    ],
  };
}

const MATCH: Match = {
  slug: '2001-05-23-bayern-munich-valencia',
  transfermarktId: '990248',
  competitionSlug: 'champions-league',
  season: '2000-01',
  date: '2001-05-23',
  stage: 'Final',
  nickname: null,
  homeClubSlug: 'bayern-munich',
  awayClubSlug: 'valencia',
  score: { home: 1, away: 1 },
  extraTime: true,
  shootout: { home: 5, away: 4 },
  home: team('h'),
  away: team('a'),
  events: [
    {
      kind: 'penalty_goal',
      minute: 3,
      addedTime: null,
      side: 'away',
      playerSlug: 'gaizka-mendieta',
    },
  ],
  memorability: {
    score: 100,
    signals: { stage: 1, sides: SIDES },
    algorithmVersion: 's10-v1',
    computedAt: '2026-10-27T14:57:30Z',
  },
};

const DATASET: DatasetInput = {
  competitions: [
    { slug: 'champions-league', kind: 'ucl', name: 'Champions League' },
  ],
  clubs: [
    {
      slug: 'bayern-munich',
      kind: 'club',
      name: 'Bayern Munich',
      shortName: 'BAY',
      crestKey: null,
      transfermarktId: '27',
      aliases: ['FC Bayern Munich'],
    },
  ],
  players: [
    {
      slug: 'oliver-kahn',
      name: 'Oliver Kahn',
      imageKey: null,
      transfermarktId: '206',
      aliases: ['Oliver Kahn', 'Kahn', 'Oliver Rolf Kahn'],
    },
  ],
  matches: [MATCH, { ...MATCH, slug: 'second-leg', date: '2001-05-30' }],
};

describe('wantedRows', () => {
  const rows = wantedRows(DATASET);

  it('implies one season per competition and label', () => {
    expect(rows.seasons).toEqual([
      { competition: 'champions-league', label: '2000-01', startYear: 2000 },
    ]);
  });

  it('flattens aliases with their normalised form', () => {
    expect(rows.clubAliases).toEqual([
      { club: 'bayern-munich', alias: 'FC Bayern Munich' },
    ]);
    expect(rows.playerAliases.map((a) => a.normalized)).toEqual([
      'oliver kahn',
      'kahn',
      'oliver rolf kahn',
    ]);
  });

  it('splits the shootout and keeps the ids', () => {
    expect(rows.matches[0]).toMatchObject({
      transfermarktId: '990248',
      extraTime: true,
      shootoutHome: 5,
      shootoutAway: 4,
      date: '2001-05-23',
    });
    expect(rows.clubs[0].transfermarktId).toBe('27');
    expect(rows.players[0].transfermarktId).toBe('206');
  });

  it('gives two teams, both XIs and the events per match', () => {
    expect(rows.matchTeams.filter((t) => t.match === MATCH.slug)).toEqual([
      {
        match: MATCH.slug,
        side: 'home',
        club: 'bayern-munich',
        goals: 1,
        formation: '4-4-2',
      },
      {
        match: MATCH.slug,
        side: 'away',
        club: 'valencia',
        goals: 1,
        formation: '4-4-2',
      },
    ]);
    expect(rows.lineups).toHaveLength(8);
    expect(rows.matchEvents[0]).toEqual({
      match: MATCH.slug,
      kind: 'penalty_goal',
      minute: 3,
      addedTime: null,
      side: 'away',
      player: 'gaizka-mendieta',
    });
  });

  it('writes the score with canonical signals and a full instant', () => {
    expect(rows.memorabilityScores[0]).toEqual({
      match: MATCH.slug,
      score: 100,
      signals: canonicalJson({ stage: 1, sides: SIDES }),
      algorithmVersion: 's10-v1',
      computedAt: '2026-10-27T14:57:30.000Z',
    });
  });
});

describe('canonicalJson', () => {
  it('ignores key order at every depth, keeps array order', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, 1], c: null } })).toBe(
      canonicalJson({ a: { c: null, d: [2, 1] }, b: 1 }),
    );
    expect(canonicalJson({ a: [1, 2] })).not.toBe(canonicalJson({ a: [2, 1] }));
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });
});

describe('isoInstant', () => {
  it('matches what Postgres returns for the same instant', () => {
    expect(isoInstant('2026-10-27T14:57:30Z')).toBe('2026-10-27T14:57:30.000Z');
    expect(isoInstant('2026-10-27T14:57:30.000Z')).toBe(
      '2026-10-27T14:57:30.000Z',
    );
  });
});
