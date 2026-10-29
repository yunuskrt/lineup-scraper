import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { DATA_DIRS } from '@/config/data-dirs.js';
import type { DatasetSources } from '@/dataset/build.js';
import {
  clubKindSchema,
  competitionKindSchema,
  matchEventKindSchema,
  positionGroupSchema,
  sideSchema,
} from '@/dataset/enums.js';
import { sideSignalsBlockSchema } from '@/dataset/side-signals.js';
import { keysBySlug, readImageKeys } from '@/images/keys.js';
import { resolvedMatchSchema } from '@/resolve/resolve.js';

export const WORK = DATA_DIRS.work;
export const RESOLVED = path.join(WORK, 'resolved');

const competitionsSchema = z.array(
  z.object({ slug: z.string(), kind: competitionKindSchema, name: z.string() }),
);
const clubsSchema = z.array(
  z.strictObject({
    aliases: z.array(z.string()),
    kind: clubKindSchema,
    name: z.string(),
    shortName: z.string(),
    slug: z.string(),
    transfermarktId: z.string(),
  }),
);
const playersSchema = z.array(
  z.object({ name: z.string(), slug: z.string(), transfermarktId: z.string() }),
);
const aliasesSchema = z.array(
  z.object({ aliases: z.array(z.string()), transfermarktId: z.string() }),
);
const goalsSchema = z.number().int().nonnegative();
const sideSchemaOf = z.object({
  formation: z.string().nullable(),
  goals: goalsSchema,
  starters: z.array(
    z.object({
      position: positionGroupSchema,
      slot: z.number(),
      transfermarktId: z.string(),
    }),
  ),
});
const lineupsSchema = z.array(
  z.object({
    events: z.array(
      z.object({
        addedTime: z.number().nullable(),
        kind: matchEventKindSchema,
        minute: z.number().nullable(),
        player: z.string().nullable(),
        side: sideSchema,
      }),
    ),
    extraTime: z.boolean(),
    shootout: z.object({ away: goalsSchema, home: goalsSchema }).nullable(),
    sides: z.object({ away: sideSchemaOf, home: sideSchemaOf }),
    slug: z.string(),
  }),
);
const scoresSchema = z.array(
  z.object({
    algorithmVersion: z.string(),
    computedAt: z.string(),
    score: z.number(),
    signals: z.record(z.string(), z.unknown()),
    slug: z.string(),
  }),
);
const gateSchema = z.array(
  z.object({
    passed: z.boolean(),
    sides: sideSignalsBlockSchema.shape.sides,
    slug: z.string(),
  }),
);

// Names the file and the path, never a value
export function readJson<T>(file: string, schema: z.ZodType<T>): T {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw new Error(`Invalid JSON in ${path.basename(file)}`);
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const at = parsed.error.issues[0]?.path.join('.') ?? '';
    throw new Error(`Invalid ${path.basename(file)} at ${at || '(root)'}`);
  }
  return parsed.data;
}

function bySlug<T extends { slug: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.slug, item]));
}

export function readSources(): DatasetSources {
  const work = (...parts: string[]): string => path.join(WORK, ...parts);
  const images = readImageKeys();
  return {
    competitions: readJson(
      path.join(RESOLVED, 'competitions.json'),
      competitionsSchema,
    ),
    clubs: readJson(path.join(RESOLVED, 'clubs.json'), clubsSchema),
    matches: readJson(
      path.join(RESOLVED, 'matches.json'),
      z.array(resolvedMatchSchema),
    ),
    players: new Map(
      readJson(path.join(RESOLVED, 'players.json'), playersSchema).map((p) => [
        p.transfermarktId,
        p,
      ]),
    ),
    aliases: new Map(
      readJson(work('aliases', 'players.json'), aliasesSchema).map((p) => [
        p.transfermarktId,
        p.aliases,
      ]),
    ),
    lineups: bySlug(readJson(work('lineups', 'matches.json'), lineupsSchema)),
    scores: bySlug(readJson(work('scores', 'matches.json'), scoresSchema)),
    gate: bySlug(readJson(work('gate', 'matches.json'), gateSchema)),
    crestKeys: keysBySlug(images.crests),
    imageKeys: keysBySlug(images.photos),
  };
}

// The stages `npm run dataset` reads, in order
export const SOURCE_STAGES = ['lineups', 'aliases', 'scores', 'gate'] as const;

export function missingSources(): string | null {
  const needed = SOURCE_STAGES.map((stage) => path.join(WORK, stage));
  for (const dir of [RESOLVED, ...needed]) {
    if (!existsSync(dir)) {
      return `Missing ${dir}: run resolve, lineups, aliases, scores and gate first`;
    }
  }
  return null;
}
