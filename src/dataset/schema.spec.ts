import { SQUAD_SIZE } from '@/dataset/constants.js';
import { positionForSlot } from '@/dataset/formation.js';
import { formatDatasetIssues } from '@/dataset/issues.js';
import { type DatasetInput, datasetSchema } from '@/dataset/schema.js';

type Team = DatasetInput['matches'][number]['home'];

// Fictional teams; players are `<team>-<slot>`
function team(prefix: string, formation: string): Team {
  return {
    formation,
    lineup: Array.from({ length: SQUAD_SIZE }, (_, slot) => ({
      playerSlug: `${prefix}-${slot}`,
      slot,
      position: positionForSlot(formation, slot) ?? 'GK',
    })),
  };
}

function players(prefix: string, label: string): DatasetInput['players'] {
  return Array.from({ length: SQUAD_SIZE }, (_, slot) => ({
    slug: `${prefix}-${slot}`,
    name: `${label} ${slot}`,
    imageKey: null,
    transfermarktId: null,
    aliases: [`${label} ${slot}`],
  }));
}

const signals = {
  stage: 0.4,
  sides: {
    home: { guessability: 0.9, starPower: 0.6 },
    away: { guessability: 0.8, starPower: 0.7 },
  },
};

const VALID: DatasetInput = {
  competitions: [
    { slug: 'northern-league', kind: 'league', name: 'Northern League' },
    { slug: 'world-cup', kind: 'world_cup', name: 'World Cup' },
  ],
  clubs: [
    {
      slug: 'northgate',
      kind: 'club',
      name: 'Northgate United',
      shortName: 'NGU',
      crestKey: 'crests/northgate.png',
      transfermarktId: '985',
      aliases: ['Northgate', 'NGU'],
    },
    {
      slug: 'rivermouth',
      kind: 'club',
      name: 'Rivermouth',
      shortName: 'RVM',
      crestKey: null,
      transfermarktId: null,
      aliases: [],
    },
    {
      slug: 'ardenia',
      kind: 'national_team',
      name: 'Ardenia',
      shortName: 'ARD',
      crestKey: null,
      transfermarktId: null,
      aliases: [],
    },
    {
      slug: 'belmora',
      kind: 'national_team',
      name: 'Belmora',
      shortName: 'BEL',
      crestKey: null,
      transfermarktId: null,
      aliases: [],
    },
  ],
  players: [
    ...players('ngu', 'Northgate'),
    ...players('rvm', 'Rivermouth'),
    ...players('ard', 'Ardenia'),
    ...players('bel', 'Belmora'),
  ],
  matches: [
    {
      slug: 'northgate-rivermouth-2005-05-03',
      transfermarktId: '990248',
      competitionSlug: 'northern-league',
      season: '2004-05',
      date: '2005-05-03',
      stage: 'Matchday 34',
      nickname: null,
      homeClubSlug: 'northgate',
      awayClubSlug: 'rivermouth',
      score: { home: 2, away: 1 },
      extraTime: false,
      shootout: null,
      home: team('ngu', '4-4-2'),
      away: team('rvm', '3-5-2'),
      events: [
        {
          kind: 'goal',
          minute: 12,
          addedTime: null,
          side: 'home',
          playerSlug: 'ngu-9',
        },
        {
          kind: 'red_card',
          minute: 60,
          addedTime: null,
          side: 'away',
          playerSlug: 'rvm-4',
        },
        // An own goal counts for the other side
        {
          kind: 'own_goal',
          minute: 90,
          addedTime: 3,
          side: 'away',
          playerSlug: 'ngu-2',
        },
        {
          kind: 'penalty_goal',
          minute: 45,
          addedTime: 2,
          side: 'home',
          playerSlug: null,
        },
      ],
      memorability: {
        score: 72.5,
        signals,
        algorithmVersion: 's10-v1',
        computedAt: '2026-10-25T00:00:00.000Z',
      },
    },
    {
      slug: 'ardenia-belmora-2006-07-09',
      transfermarktId: null,
      competitionSlug: 'world-cup',
      season: '2006',
      date: '2006-07-09',
      stage: 'Final',
      nickname: 'The Long Night',
      homeClubSlug: 'ardenia',
      awayClubSlug: 'belmora',
      score: { home: 1, away: 1 },
      extraTime: true,
      shootout: { home: 5, away: 3 },
      home: team('ard', '4-2-3-1'),
      away: team('bel', '4-1-2-1-2'),
      events: [],
      memorability: {
        score: 95,
        signals,
        algorithmVersion: 's10-v1',
        computedAt: '2026-10-25T00:00:00.000Z',
      },
    },
  ],
};

// A deep copy with one change applied
function edited(change: (input: DatasetInput) => void): DatasetInput {
  const copy = structuredClone(VALID);
  change(copy);
  return copy;
}

// `path: message` per issue
function issuesOf(input: unknown): string[] {
  const result = datasetSchema.safeParse(input);
  if (result.success) return [];
  return result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
}

const firstMatch = (input: DatasetInput) => input.matches[0];

describe('datasetSchema', () => {
  it('accepts a valid dataset unchanged', () => {
    expect(issuesOf(VALID)).toEqual([]);
    expect(datasetSchema.parse(VALID)).toEqual(VALID);
  });

  it('keeps signal keys beyond sides', () => {
    const data = datasetSchema.parse(VALID);
    expect(data.matches[0].memorability.signals).toHaveProperty('stage', 0.4);
  });

  it.each([
    ['Euro 2020 played in 2021', 'euro', '2020', '2021-07-11'],
    ['a 2019-20 club final in August', 'league', '2019-20', '2020-08-23'],
  ] as const)('accepts %s', (_, kind, season, date) => {
    const input = edited((i) => {
      const competition = kind === 'euro' ? 1 : 0;
      i.competitions[competition].kind = kind;
      i.matches[competition].season = season;
      i.matches[competition].date = date;
    });
    expect(issuesOf(input)).toEqual([]);
  });

  it.each([105, 120])('accepts added time after minute %i', (minute) => {
    const input = edited((i) => {
      i.matches[1].events.push({
        kind: 'goal',
        minute,
        addedTime: 1,
        side: 'home',
        playerSlug: 'ard-10',
      });
    });
    expect(issuesOf(input)).toEqual([]);
  });

  it('keeps a shared surname on two players', () => {
    const input = edited((i) => {
      i.players[0].aliases.push('Silva');
      i.players[1].aliases.push('Silva');
    });
    expect(issuesOf(input)).toEqual([]);
  });

  it('accepts a raw alias the pipeline can normalize', () => {
    const input = edited((i) => {
      i.players[0].aliases.push('  Ünal-Ödemiş ');
    });
    expect(issuesOf(input)).toEqual([]);
  });

  it.each(['', '   ', '-—–', 'Аршавин', '!!!'])(
    'rejects the alias %j',
    (alias) => {
      const input = edited((i) => {
        i.players[0].aliases.push(alias);
      });
      expect(
        issuesOf(input).some((i) => i.startsWith('players.0.aliases.1')),
      ).toBe(true);
    },
  );

  describe('rejects', () => {
    it.each<[string, (input: DatasetInput) => void, string]>([
      // Text and slugs
      [
        'a blank name',
        (i) => {
          i.clubs[0].name = '  ';
        },
        'clubs.0.name: Invalid string: must match pattern /\\S/',
      ],
      [
        'a decomposed name',
        (i) => {
          i.players[0].name = 'S\u0327ahin';
        },
        'players.0.name: Text must be NFC',
      ],
      [
        'a malformed slug',
        (i) => {
          i.clubs[0].slug = 'North Gate';
        },
        'clubs.0.slug: Invalid string: must match pattern /^[a-z0-9]+(-[a-z0-9]+)*$/',
      ],
      [
        'a reserved prefix',
        (i) => {
          i.competitions[0].slug = 'comp-north';
        },
        'competitions.0.slug: Slug uses a reserved prefix',
      ],
      [
        'a mock seed player slug',
        (i) => {
          i.players[0].slug = 'pl-northgate';
        },
        'players.0.slug: Slug uses a reserved prefix',
      ],
      [
        'a duplicate club',
        (i) => {
          i.clubs.push(i.clubs[1]);
        },
        'clubs.4.slug: Duplicate slug',
      ],
      [
        'a duplicate match',
        (i) => {
          i.matches.push(i.matches[0]);
        },
        'matches.2.slug: Duplicate slug',
      ],
      [
        'an unknown key',
        (i) => {
          Object.assign(i.matches[0], { nickame: 'x' });
        },
        'matches.0: Unrecognized key: "nickame"',
      ],
      // References
      [
        'an unknown competition',
        (i) => {
          firstMatch(i).competitionSlug = 'southern-league';
        },
        'matches.0.competitionSlug: Unknown competition',
      ],
      [
        'an unknown club',
        (i) => {
          firstMatch(i).awayClubSlug = 'eastport';
        },
        'matches.0.awayClubSlug: Unknown club',
      ],
      [
        'an unknown lineup player',
        (i) => {
          firstMatch(i).home.lineup[3].playerSlug = 'nobody';
        },
        'matches.0.home.lineup.3.playerSlug: Unknown player',
      ],
      [
        'an unknown event player',
        (i) => {
          firstMatch(i).events[0].playerSlug = 'nobody';
        },
        'matches.0.events.0.playerSlug: Unknown player',
      ],
      // Clubs
      [
        'a two-letter short name',
        (i) => {
          i.clubs[0].shortName = 'NG';
        },
        'clubs.0.shortName: Must be 3 capitals or digits',
      ],
      [
        'a lower-case short name',
        (i) => {
          i.clubs[0].shortName = 'ngu';
        },
        'clubs.0.shortName: Must be 3 capitals or digits',
      ],
      [
        'a four-letter short name',
        (i) => {
          i.clubs[0].shortName = 'NGUT';
        },
        'clubs.0.shortName: Must be 3 capitals or digits',
      ],
      [
        'a crest URL',
        (i) => {
          i.clubs[0].crestKey = 'https://cdn.example.com/a.png';
        },
        'clubs.0.crestKey: Must be a bucket key, not a URL',
      ],
      [
        'a root-relative crest',
        (i) => {
          i.clubs[0].crestKey = '/crests/a.png';
        },
        'clubs.0.crestKey: Must be a bucket key, not a URL',
      ],
      [
        'a duplicate club alias',
        (i) => {
          i.clubs[0].aliases.push('Northgate');
        },
        'clubs.0.aliases: Club aliases must be unique',
      ],
      // Players
      [
        'a player with no alias',
        (i) => {
          i.players[0].aliases = [];
        },
        'players.0.aliases: Too small: expected array to have >=1 items',
      ],
      [
        'a duplicate alias',
        (i) => {
          i.players[0].aliases.push(i.players[0].aliases[0]);
        },
        'players.0.aliases: Aliases must not normalize alike',
      ],
      [
        'two aliases that normalize alike',
        (i) => {
          i.players[0].aliases.push('NORTHGATE 0');
        },
        'players.0.aliases: Aliases must not normalize alike',
      ],
      [
        'an image URL',
        (i) => {
          i.players[0].imageKey = 'http://img.example.com/p.jpg';
        },
        'players.0.imageKey: Must be a bucket key, not a URL',
      ],
      // Seasons
      [
        'a date outside the season',
        (i) => {
          firstMatch(i).date = '2005-07-01';
        },
        'matches.0.season: Date is outside the season',
      ],
      [
        'a malformed season',
        (i) => {
          firstMatch(i).season = '2004/05';
        },
        'matches.0.season: Invalid string: must match pattern /^\\d{4}(-\\d{2})?$/',
      ],
      [
        'non-consecutive years',
        (i) => {
          firstMatch(i).season = '2004-06';
        },
        'matches.0.season: Season years must be consecutive',
      ],
      [
        'a two-year tournament season',
        (i) => {
          i.matches[1].season = '2006-07';
        },
        'matches.1.season: Tournament seasons are a single year',
      ],
      [
        'a season before 2000',
        (i) => {
          firstMatch(i).season = '1999-00';
        },
        'matches.0.season: Season is outside the covered range',
      ],
      // Matches
      [
        'the same club on both sides',
        (i) => {
          firstMatch(i).awayClubSlug = 'northgate';
        },
        'matches.0.awayClubSlug: Home and away clubs must differ',
      ],
      [
        'a negative score',
        (i) => {
          firstMatch(i).score.home = -1;
        },
        'matches.0.score.home: Too small: expected number to be >=0',
      ],
      [
        'a fractional score',
        (i) => {
          firstMatch(i).score.away = 1.5;
        },
        'matches.0.score.away: Invalid input: expected int, received number',
      ],
      [
        'a level shootout',
        (i) => {
          i.matches[1].shootout = { home: 4, away: 4 };
        },
        'matches.1.shootout: A shootout never ends level',
      ],
      [
        'an invalid date',
        (i) => {
          firstMatch(i).date = '2005-02-30';
        },
        'matches.0.date: Invalid ISO date',
      ],
      [
        'an empty stage',
        (i) => {
          firstMatch(i).stage = '';
        },
        'matches.0.stage: Invalid string: must match pattern /\\S/',
      ],
      // Club kind
      [
        'a national team in a league',
        (i) => {
          firstMatch(i).awayClubSlug = 'ardenia';
        },
        'matches.0.awayClubSlug: Club kind does not fit the competition',
      ],
      [
        'a club at a World Cup',
        (i) => {
          i.matches[1].homeClubSlug = 'northgate';
        },
        'matches.1.homeClubSlug: Club kind does not fit the competition',
      ],
      // Sides
      [
        'an eleven-outfield formation',
        (i) => {
          firstMatch(i).home.formation = '4-4-3';
        },
        'matches.0.home.formation: Formation lines must total 10 outfield players',
      ],
      [
        'a ten-player XI',
        (i) => {
          firstMatch(i).home.lineup.pop();
        },
        'matches.0.home.lineup: Too small: expected array to have exactly 11 items',
      ],
      [
        'a duplicate slot',
        (i) => {
          firstMatch(i).home.lineup[2].slot = 1;
        },
        'matches.0.home: Slots must be unique',
      ],
      [
        'a player twice in one XI',
        (i) => {
          firstMatch(i).home.lineup[2].playerSlug = 'ngu-3';
        },
        'matches.0.home: Players must be unique',
      ],
      [
        'a keeper outside slot 0',
        (i) => {
          firstMatch(i).home.lineup[5].position = 'GK';
        },
        'matches.0.home.lineup.5.position: Position must match the formation',
      ],
      [
        'an outfielder in slot 0',
        (i) => {
          firstMatch(i).home.lineup[0].position = 'DF';
        },
        'matches.0.home.lineup.0.position: Position must match the formation',
      ],
      [
        'a source label over the formation',
        (i) => {
          i.matches[1].home.lineup[7].position = 'FW';
        },
        'matches.1.home.lineup.7.position: Position must match the formation',
      ],
      [
        'a slot past 10',
        (i) => {
          firstMatch(i).home.lineup[10].slot = 11;
        },
        'matches.0.home.lineup.10.slot: Too big: expected number to be <=10',
      ],
      [
        'a player on both sides',
        (i) => {
          firstMatch(i).away.lineup[3].playerSlug = 'ngu-3';
        },
        'matches.0.away.lineup: A player starts for both sides',
      ],
      // Events
      [
        'minute 0',
        (i) => {
          firstMatch(i).events[0].minute = 0;
        },
        'matches.0.events.0.minute: Too small: expected number to be >=1',
      ],
      [
        'minute 121',
        (i) => {
          firstMatch(i).events[0].minute = 121;
        },
        'matches.0.events.0.minute: Too big: expected number to be <=120',
      ],
      [
        'added time mid-half',
        (i) => {
          firstMatch(i).events[0].addedTime = 2;
        },
        'matches.0.events.0.addedTime: Added time follows minute 45, 90, 105 or 120',
      ],
      [
        '31 minutes of added time',
        (i) => {
          firstMatch(i).events[2].addedTime = 31;
        },
        'matches.0.events.2.addedTime: Too big: expected number to be <=30',
      ],
      // Memorability
      [
        'a score over 100',
        (i) => {
          firstMatch(i).memorability.score = 100.5;
        },
        'matches.0.memorability.score: Too big: expected number to be <=100',
      ],
      [
        'a blank algorithm version',
        (i) => {
          firstMatch(i).memorability.algorithmVersion = ' ';
        },
        'matches.0.memorability.algorithmVersion: Invalid string: must match pattern /\\S/',
      ],
      [
        'a date-only computedAt',
        (i) => {
          firstMatch(i).memorability.computedAt = '2026-10-25';
        },
        'matches.0.memorability.computedAt: Invalid ISO datetime',
      ],
      [
        'missing sides',
        (i) => {
          firstMatch(i).memorability.signals = { stage: 1 } as never;
        },
        'matches.0.memorability.signals.sides: Invalid input: expected object, received undefined',
      ],
      [
        'a side signal over 1',
        (i) => {
          firstMatch(i).memorability.signals.sides.home.guessability = 1.2;
        },
        'matches.0.memorability.signals.sides.home.guessability: Too big: expected number to be <=1',
      ],
      // Added in /feature test
      [
        'a duplicate competition',
        (i) => {
          i.competitions.push(i.competitions[0]);
        },
        'competitions.2.slug: Duplicate slug',
      ],
      [
        'a duplicate player',
        (i) => {
          i.players.push(i.players[7]);
        },
        'players.44.slug: Duplicate slug',
      ],
      [
        'a club without a kind',
        (i) => {
          delete (i.clubs[0] as Partial<(typeof i.clubs)[0]>).kind;
        },
        'clubs.0.kind: Invalid option: expected one of "club"|"national_team"',
      ],
      [
        'a half-filled shootout',
        (i) => {
          i.matches[1].shootout = { home: 5 } as never;
        },
        'matches.1.shootout.away: Invalid input: expected number, received undefined',
      ],
      [
        'a yellow card event',
        (i) => {
          firstMatch(i).events[0].kind = 'yellow_card' as never;
        },
        'matches.0.events.0.kind: Invalid option: expected one of "goal"|"own_goal"|"penalty_goal"|"red_card"',
      ],
      [
        'a Euro 2020 date outside its window',
        (i) => {
          i.competitions[1].kind = 'euro';
          i.matches[1].season = '2020';
          i.matches[1].date = '2021-08-01';
        },
        'matches.1.season: Date is outside the season',
      ],
    ])('%s', (_, change, issue) => {
      expect(issuesOf(edited(change))).toContain(issue);
    });
  });
});

describe('formatDatasetIssues', () => {
  it('prints paths and messages, never the values', () => {
    const input = edited((i) => {
      i.players[0].name = 'Secretname\u0301';
      i.players[0].aliases.push('!!!');
      i.clubs[0].shortName = 'secret';
      i.clubs[0].crestKey = 'https://secret.example.com/crest.png';
      firstMatch(i).home.lineup[5].position = 'GK';
    });
    const result = datasetSchema.safeParse(input);
    if (result.success) throw new Error('expected failure');

    const text = formatDatasetIssues(result.error);
    expect(text.toLowerCase()).not.toContain('secret');
    expect(text.split('\n')).toEqual(
      expect.arrayContaining([
        'Invalid dataset:',
        '  players[0].name: Text must be NFC',
        '  players[0].aliases[1]: Alias must normalize to a name',
        '  clubs[0].shortName: Must be 3 capitals or digits',
        '  clubs[0].crestKey: Must be a bucket key, not a URL',
      ]),
    );
  });

  it('names the root when the input is not an object', () => {
    const result = datasetSchema.safeParse(null);
    if (result.success) throw new Error('expected failure');
    expect(formatDatasetIssues(result.error)).toBe(
      'Invalid dataset:\n  (root): Invalid input: expected object, received null',
    );
  });

  it('formats a nested lineup path', () => {
    const input = edited((i) => {
      firstMatch(i).home.lineup[5].position = 'GK';
    });
    const result = datasetSchema.safeParse(input);
    if (result.success) throw new Error('expected failure');
    expect(formatDatasetIssues(result.error)).toBe(
      'Invalid dataset:\n  matches[0].home.lineup[5].position: Position must match the formation',
    );
  });
});

describe('transfermarktId', () => {
  it('allows many nulls in a list', () => {
    expect(issuesOf(VALID)).toEqual([]);
  });

  it.each(['clubs', 'players', 'matches'] as const)(
    'refuses a duplicate in %s',
    (key) => {
      const input = edited((copy) => {
        copy[key][0].transfermarktId = '7';
        copy[key][1].transfermarktId = '7';
      });
      expect(issuesOf(input)).toEqual([
        `${key}.1.transfermarktId: Duplicate Transfermarkt id`,
      ]);
    },
  );

  it('refuses an id that is not digits', () => {
    const input = edited((copy) => {
      copy.players[0].transfermarktId = 'tm-206';
    });
    expect(issuesOf(input)).toHaveLength(1);
    expect(issuesOf(input)[0]).toMatch(/^players\.0\.transfermarktId: /);
  });
});
