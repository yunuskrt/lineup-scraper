import { z } from 'zod';
import { SQUAD_SIZE } from '@/dataset/constants.js';
import {
  type ClubKind,
  type CompetitionKind,
  clubKindSchema,
  competitionKindSchema,
  isoDateSchema,
  matchEventKindSchema,
  positionGroupSchema,
  sideSchema,
} from '@/dataset/enums.js';
import { formationSchema, positionForSlot } from '@/dataset/formation.js';
import { matchSeasonIssue } from '@/dataset/season.js';
import { sideSignalsBlockSchema } from '@/dataset/side-signals.js';
import { normalizeName } from '@/names/normalize.js';

// Used by the mock seed and the backend e2e suites
const RESERVED_PREFIXES = ['club-', 'nat-', 'comp-', 'match-', 'pl-', 'test-'];

const ADDED_TIME_MINUTES = new Set([45, 90, 105, 120]);

const NATIONAL_TEAM_KINDS: ReadonlySet<CompetitionKind> = new Set([
  'world_cup',
  'euro',
]);

const slugSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

const ownSlugSchema = slugSchema.refine(
  (slug) => !RESERVED_PREFIXES.some((prefix) => slug.startsWith(prefix)),
  { error: 'Slug uses a reserved prefix' },
);

const textSchema = z
  .string()
  .regex(/\S/)
  .refine((text) => text === text.normalize('NFC'), {
    error: 'Text must be NFC',
  });

// Stored as normalizeName(alias); never empty
const aliasSchema = textSchema.refine((alias) => normalizeName(alias) !== '', {
  error: 'Alias must normalize to a name',
});

const objectKeySchema = z
  .string()
  .regex(/^(?!\/)(?!.*:\/\/)\S+$/, 'Must be a bucket key, not a URL');

const seasonLabelSchema = z.string().regex(/^\d{4}(-\d{2})?$/);

const goalsSchema = z.number().int().nonnegative();

const competitionSchema = z.strictObject({
  slug: ownSlugSchema,
  kind: competitionKindSchema,
  name: textSchema,
});

const clubSchema = z.strictObject({
  slug: ownSlugSchema,
  kind: clubKindSchema,
  name: textSchema,
  shortName: z.string().regex(/^[A-Z0-9]{3}$/, 'Must be 3 capitals or digits'),
  crestKey: objectKeySchema.nullable(),
  // The (club_id, alias) unique key: exact text
  aliases: z
    .array(textSchema)
    .refine((aliases) => new Set(aliases).size === aliases.length, {
      error: 'Club aliases must be unique',
    }),
});

const playerSchema = z.strictObject({
  slug: ownSlugSchema,
  name: textSchema,
  imageKey: objectKeySchema.nullable(),
  aliases: z
    .array(aliasSchema)
    .min(1)
    // The (player_id, normalized) unique key
    .refine(
      (aliases) => new Set(aliases.map(normalizeName)).size === aliases.length,
      { error: 'Aliases must not normalize alike' },
    ),
});

const lineupEntrySchema = z.strictObject({
  playerSlug: slugSchema,
  slot: z
    .number()
    .int()
    .min(0)
    .max(SQUAD_SIZE - 1),
  position: positionGroupSchema,
});

const teamSchema = z
  .strictObject({
    formation: formationSchema,
    lineup: z.array(lineupEntrySchema).length(SQUAD_SIZE),
  })
  .superRefine(({ formation, lineup }, ctx) => {
    if (new Set(lineup.map((entry) => entry.slot)).size !== SQUAD_SIZE) {
      ctx.addIssue({ code: 'custom', message: 'Slots must be unique' });
    }
    if (new Set(lineup.map((entry) => entry.playerSlug)).size !== SQUAD_SIZE) {
      ctx.addIssue({ code: 'custom', message: 'Players must be unique' });
    }
    lineup.forEach((entry, index) => {
      if (entry.position !== positionForSlot(formation, entry.slot)) {
        ctx.addIssue({
          code: 'custom',
          path: ['lineup', index, 'position'],
          message: 'Position must match the formation',
        });
      }
    });
  });

const eventSchema = z
  .strictObject({
    kind: matchEventKindSchema,
    minute: z.number().int().min(1).max(120),
    addedTime: z.number().int().min(1).max(30).nullable(),
    side: sideSchema,
    playerSlug: slugSchema.nullable(),
  })
  .refine(
    (event) => event.addedTime === null || ADDED_TIME_MINUTES.has(event.minute),
    {
      path: ['addedTime'],
      error: 'Added time follows minute 45, 90, 105 or 120',
    },
  );

const shootoutSchema = z
  .strictObject({ home: goalsSchema, away: goalsSchema })
  .refine((shootout) => shootout.home !== shootout.away, {
    error: 'A shootout never ends level',
  });

const memorabilitySchema = z.strictObject({
  score: z.number().min(0).max(100),
  // Other per-signal keys are kept for QA
  signals: sideSignalsBlockSchema.loose(),
  algorithmVersion: textSchema,
  computedAt: z.iso.datetime(),
});

const matchSchema = z.strictObject({
  slug: ownSlugSchema,
  competitionSlug: slugSchema,
  season: seasonLabelSchema,
  date: isoDateSchema,
  stage: textSchema.nullable(),
  nickname: textSchema.nullable(),
  homeClubSlug: slugSchema,
  awayClubSlug: slugSchema,
  score: z.strictObject({ home: goalsSchema, away: goalsSchema }),
  extraTime: z.boolean(),
  shootout: shootoutSchema.nullable(),
  home: teamSchema,
  away: teamSchema,
  events: z.array(eventSchema),
  memorability: memorabilitySchema,
});

type Match = z.output<typeof matchSchema>;
type Issue = (path: (string | number)[], message: string) => void;

type Lookups = {
  competitionKinds: Map<string, CompetitionKind>;
  clubKinds: Map<string, ClubKind>;
  players: Set<string>;
};

const LISTS = ['competitions', 'clubs', 'players', 'matches'] as const;
const SIDES = ['home', 'away'] as const;

// One pass: the real dataset has ~20,000 players
function duplicateIndex(slugs: readonly string[]): number {
  const seen = new Set<string>();
  return slugs.findIndex((slug) => seen.size === seen.add(slug).size);
}

function checkClubs(match: Match, lookups: Lookups, issue: Issue): void {
  if (match.homeClubSlug === match.awayClubSlug) {
    issue(['awayClubSlug'], 'Home and away clubs must differ');
  }
  const kind = lookups.competitionKinds.get(match.competitionSlug);
  const expected =
    kind && NATIONAL_TEAM_KINDS.has(kind) ? 'national_team' : 'club';
  for (const key of ['homeClubSlug', 'awayClubSlug'] as const) {
    const clubKind = lookups.clubKinds.get(match[key]);
    if (!clubKind) issue([key], 'Unknown club');
    else if (kind && clubKind !== expected) {
      issue([key], 'Club kind does not fit the competition');
    }
  }
}

function checkPlayers(match: Match, lookups: Lookups, issue: Issue): void {
  for (const side of SIDES) {
    match[side].lineup.forEach((entry, slotIndex) => {
      if (!lookups.players.has(entry.playerSlug)) {
        issue([side, 'lineup', slotIndex, 'playerSlug'], 'Unknown player');
      }
    });
  }
  const homeSlugs = new Set(match.home.lineup.map((e) => e.playerSlug));
  if (match.away.lineup.some((entry) => homeSlugs.has(entry.playerSlug))) {
    issue(['away', 'lineup'], 'A player starts for both sides');
  }
  match.events.forEach((event, eventIndex) => {
    if (event.playerSlug !== null && !lookups.players.has(event.playerSlug)) {
      issue(['events', eventIndex, 'playerSlug'], 'Unknown player');
    }
  });
}

function checkMatch(match: Match, lookups: Lookups, issue: Issue): void {
  const kind = lookups.competitionKinds.get(match.competitionSlug);
  if (!kind) issue(['competitionSlug'], 'Unknown competition');
  checkClubs(match, lookups, issue);
  checkPlayers(match, lookups, issue);
  const season = kind ? matchSeasonIssue(kind, match.season, match.date) : null;
  if (season) issue(['season'], season);
}

export const datasetSchema = z
  .strictObject({
    competitions: z.array(competitionSchema),
    clubs: z.array(clubSchema),
    players: z.array(playerSchema),
    matches: z.array(matchSchema),
  })
  .superRefine((data, ctx) => {
    for (const key of LISTS) {
      const index = duplicateIndex(data[key].map((item) => item.slug));
      if (index >= 0) {
        ctx.addIssue({
          code: 'custom',
          path: [key, index, 'slug'],
          message: 'Duplicate slug',
        });
      }
    }

    const lookups: Lookups = {
      competitionKinds: new Map(data.competitions.map((c) => [c.slug, c.kind])),
      clubKinds: new Map(data.clubs.map((club) => [club.slug, club.kind])),
      players: new Set(data.players.map((player) => player.slug)),
    };
    data.matches.forEach((match, index) => {
      checkMatch(match, lookups, (path, message) =>
        ctx.addIssue({
          code: 'custom',
          path: ['matches', index, ...path],
          message,
        }),
      );
    });
  });

export type DatasetInput = z.input<typeof datasetSchema>;
export type Dataset = z.output<typeof datasetSchema>;
