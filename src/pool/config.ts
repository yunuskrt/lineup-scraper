import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { DATA_DIRS } from '@/config/data-dirs.js';
import { FIRST_SEASON_START, LAST_SEASON_START } from '@/dataset/constants.js';
import { competitionKindSchema } from '@/dataset/enums.js';

export const POOL_CONFIG_FILE = path.join(DATA_DIRS.curation, 'pool.json');

export const poolGroupSchema = z.enum([
  'derbies',
  'clashes',
  'ucl-knockouts',
  'uel-finals',
  'world-cup-knockouts',
  'euro-knockouts',
]);

const tmIdSchema = z.string().regex(/^[0-9]+$/);
const codeSchema = z.string().regex(/^[A-Z0-9]+$/);
const keySchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const labelSchema = z.string().trim().min(1);

const competitionSchema = z.strictObject({
  code: codeSchema,
  kind: competitionKindSchema,
  name: labelSchema,
  urlSlug: keySchema,
  // league: ?saison_id=YYYY; cup: /saison_id/YYYY
  linkStyle: z.enum(['league', 'cup']),
  // Transfermarkt saison_id values: first, last, step
  seasons: z.strictObject({
    first: z.int(),
    last: z.int(),
    step: z.int().min(1),
  }),
  groups: z.array(poolGroupSchema).min(1),
  isVerified: z.boolean(),
});

// id stays null until a saved page shows it
const clubSchema = z.strictObject({
  key: keySchema,
  name: labelSchema,
  league: codeSchema,
  id: tmIdSchema.nullable(),
});

const derbySchema = z.strictObject({
  name: labelSchema,
  clubs: z.tuple([keySchema, keySchema]),
});

// World Cup and Euro saison_id is the year before
export function startYear(kind: string, seasonId: number): number {
  return kind === 'world_cup' || kind === 'euro' ? seasonId + 1 : seasonId;
}

export const poolConfigSchema = z
  .strictObject({
    competitions: z.array(competitionSchema).min(1),
    clubs: z.array(clubSchema),
    derbies: z.array(derbySchema),
    knockoutStages: z.partialRecord(
      poolGroupSchema,
      z.array(labelSchema).min(1),
    ),
  })
  .superRefine((config, ctx) => {
    const issue = (message: string, at: (string | number)[]) =>
      ctx.addIssue({ code: 'custom', message, path: at });
    const codes = new Set(config.competitions.map((c) => c.code));
    const leagues = new Map(config.clubs.map((c) => [c.key, c.league]));
    config.competitions.forEach(({ kind, seasons }, i) => {
      const first = startYear(kind, seasons.first);
      const last = startYear(kind, seasons.last);
      if (
        first > last ||
        first < FIRST_SEASON_START ||
        last > LAST_SEASON_START
      ) {
        issue('Seasons are outside the covered range', [
          'competitions',
          i,
          'seasons',
        ]);
      }
    });
    const keys = new Set<string>();
    const ids = new Set<string>();
    config.clubs.forEach((club, i) => {
      if (!codes.has(club.league))
        issue('Unknown league code', ['clubs', i, 'league']);
      if (keys.has(club.key)) issue('Duplicate club key', ['clubs', i, 'key']);
      if (club.id !== null && ids.has(club.id)) {
        issue('Duplicate club id', ['clubs', i, 'id']);
      }
      keys.add(club.key);
      if (club.id !== null) ids.add(club.id);
    });
    config.derbies.forEach((derby, i) => {
      const [a, b] = derby.clubs.map((key) => leagues.get(key));
      if (a === undefined || b === undefined) {
        issue('Derby club is not in clubs', ['derbies', i, 'clubs']);
      } else if (a !== b) {
        issue('Derby clubs play in different leagues', ['derbies', i, 'clubs']);
      }
    });
  });

export type PoolConfig = z.infer<typeof poolConfigSchema>;

export function readPoolConfig(file = POOL_CONFIG_FILE): PoolConfig {
  return poolConfigSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
}
