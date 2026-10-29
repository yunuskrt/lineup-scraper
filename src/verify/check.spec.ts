import {
  checkMatch,
  storedImageKeys,
  verifyState,
  type Expected,
  type StoredMatch,
  type StoredTeam,
  type VerifyState,
} from '@/verify/check.js';

const SIGNALS = {
  sides: {
    home: { guessability: 0.9, starPower: 0.8 },
    away: { guessability: 0.7, starPower: 0.6 },
  },
};

// 4-4-2: GK, DF 1–4, MF 5–8, FW 9–10
const POSITIONS = ['GK', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'MF']
  .concat(['FW', 'FW'])
  .map((position) => position as StoredTeam['lineups'][number]['position']);

function team(side: StoredTeam['side']): StoredTeam {
  return {
    side,
    formation: '4-4-2',
    lineups: POSITIONS.map((position, slot) => ({
      slot,
      position,
      aliasCount: 2,
    })),
  };
}

function match(overrides: Partial<StoredMatch> = {}): StoredMatch {
  return {
    slug: '2001-05-23-bayern-munich-valencia',
    kind: 'ucl',
    score: 80,
    signals: SIGNALS,
    teams: [team('home'), team('away')],
    events: 2,
    ...overrides,
  };
}

function state(overrides: Partial<VerifyState> = {}): VerifyState {
  return {
    competitions: ['champions-league'],
    clubs: [
      { slug: 'bayern-munich', crestKey: 'crests/bayern-munich/a.webp' },
      { slug: 'valencia', crestKey: null },
    ],
    players: [
      {
        slug: 'oliver-kahn',
        imageKey: 'players/oliver-kahn/b.webp',
        aliases: [
          { alias: 'Kahn', normalized: 'kahn' },
          { alias: 'Oliver Kahn', normalized: 'oliver kahn' },
        ],
      },
    ],
    matches: [match()],
    ...overrides,
  };
}

const EXPECTED: Expected = {
  competitions: ['champions-league'],
  clubs: ['bayern-munich', 'valencia'],
  players: ['oliver-kahn'],
  matches: ['2001-05-23-bayern-munich-valencia'],
  counts: {
    aliases: 2,
    clubs: 2,
    competitions: 1,
    crests: 1,
    events: 2,
    lineups: 22,
    matches: 1,
    photos: 1,
    players: 1,
  },
};

describe('checkMatch', () => {
  it('passes a scored, complete, playable match', () => {
    expect(checkMatch(match())).toEqual([]);
  });

  it('applies the tournament threshold to ucl and the league one otherwise', () => {
    expect(checkMatch(match({ score: 45 }))).toEqual([]);
    expect(checkMatch(match({ score: 44.9 }))).toEqual(['score below 45']);
    expect(checkMatch(match({ kind: 'league', score: 59 }))).toEqual([
      'score below 60',
    ]);
  });

  it('flags an unscored match and a bad sides block', () => {
    expect(checkMatch(match({ score: null, signals: null }))).toEqual([
      'no memorability score',
      'invalid sides block',
    ]);
    expect(checkMatch(match({ signals: { sides: { home: {} } } }))).toEqual([
      'invalid sides block',
    ]);
  });

  it('needs one home and one away side', () => {
    expect(checkMatch(match({ teams: [team('home')] }))).toEqual([
      'not one home and one away',
    ]);
    expect(checkMatch(match({ teams: [team('home'), team('home')] }))).toEqual([
      'not one home and one away',
    ]);
  });

  it('checks both sides: formation, 11 starters, positions and aliases', () => {
    const away = team('away');
    away.lineups[5] = { slot: 5, position: 'DF', aliasCount: 2 };
    away.lineups[9] = { slot: 9, position: 'FW', aliasCount: 0 };
    const home = { ...team('home'), lineups: team('home').lineups.slice(1) };

    expect(checkMatch(match({ teams: [home, away] }))).toEqual([
      'home: 10 starters, not 11',
      'away: slot 5 has the wrong position',
      'away: slot 9 has no alias',
    ]);
    expect(
      checkMatch(
        match({ teams: [{ ...home, formation: null }, team('away')] }),
      ),
    ).toEqual(['home: no formation']);
  });
});

describe('verifyState', () => {
  it('passes when the database holds the dataset', () => {
    expect(verifyState(state(), EXPECTED)).toEqual([]);
  });

  it('names what the database lacks, by slug', () => {
    const failures = verifyState(
      state({ clubs: [], matches: [], competitions: [] }),
      EXPECTED,
    );

    expect(failures.map((f) => f.subject)).toEqual([
      'competition champions-league',
      'club bayern-munich',
      'club valencia',
      'match 2001-05-23-bayern-munich-valencia',
      'count clubs',
      'count competitions',
      'count crests',
      'count events',
      'count lineups',
      'count matches',
    ]);
    expect(failures[0]?.rule).toBe('not in the database');
  });

  it('flags a served match the dataset no longer has', () => {
    const stale = match({ slug: '2003-01-01-old-match' });
    const failures = verifyState(
      state({ matches: [match(), stale] }),
      EXPECTED,
    );

    expect(failures).toEqual([
      {
        subject: 'match 2003-01-01-old-match',
        rule: 'served but not in the dataset',
      },
    ]);
  });

  it('flags aliases that differ from normalizeName, never printing them', () => {
    const failures = verifyState(
      state({
        players: [
          {
            slug: 'oliver-kahn',
            imageKey: 'players/oliver-kahn/b.webp',
            aliases: [
              { alias: 'Kahn', normalized: 'Kahn' },
              { alias: 'Oliver Kahn', normalized: 'oliver kahn' },
            ],
          },
        ],
      }),
      EXPECTED,
    );

    expect(failures).toEqual([
      {
        subject: 'player oliver-kahn',
        rule: '1 aliases not normalizeName(alias)',
      },
    ]);
  });

  it('flags a player with no alias and a count off the manifest', () => {
    const failures = verifyState(
      state({
        players: [{ slug: 'oliver-kahn', imageKey: null, aliases: [] }],
      }),
      EXPECTED,
    );

    expect(failures).toEqual([
      { subject: 'player oliver-kahn', rule: 'no alias' },
      { subject: 'count aliases', rule: 'database 0, manifest 2' },
      { subject: 'count photos', rule: 'database 0, manifest 1' },
    ]);
  });
});

describe('storedImageKeys', () => {
  it('lists the stored crest and photo keys, sorted', () => {
    expect(storedImageKeys(state())).toEqual([
      'crests/bayern-munich/a.webp',
      'players/oliver-kahn/b.webp',
    ]);
  });
});
