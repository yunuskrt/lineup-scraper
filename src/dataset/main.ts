import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { DATA_DIRS } from '@/config/data-dirs.js';
import { buildDataset, type DatasetSources } from '@/dataset/build.js';
import {
  clubKindSchema,
  competitionKindSchema,
  matchEventKindSchema,
  positionGroupSchema,
  sideSchema,
} from '@/dataset/enums.js';
import { sha256 } from '@/dataset/files.js';
import { renderReport } from '@/dataset/report.js';
import { sideSignalsBlockSchema } from '@/dataset/side-signals.js';
import { writeDataset } from '@/dataset/write.js';
import { resolvedMatchSchema } from '@/resolve/resolve.js';

const WORK = DATA_DIRS.work;
const RESOLVED = path.join(WORK, 'resolved');
const SCHEMA_FILE = new URL('../../prisma/schema.prisma', import.meta.url);
const REPORT_FILE = path.join(DATA_DIRS.reports, 'dataset.md');

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
function readJson<T>(file: string, schema: z.ZodType<T>): T {
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

function readSources(): DatasetSources {
  const work = (...parts: string[]): string => path.join(WORK, ...parts);
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
  };
}

function main(): number {
  const needed = ['lineups', 'aliases', 'scores', 'gate'].map((stage) =>
    path.join(WORK, stage),
  );
  for (const dir of [RESOLVED, ...needed]) {
    if (!existsSync(dir)) {
      console.error(
        `Missing ${dir}: run resolve, lineups, aliases, scores and gate first`,
      );
      return 1;
    }
  }
  const build = buildDataset(readSources());
  const schemaHash = sha256(readFileSync(SCHEMA_FILE, 'utf8'));
  const written = writeDataset(DATA_DIRS.dataset, build.dataset, schemaHash);
  if (!written.success) {
    // Nothing is written (data-contract § 1.6)
    console.error(written.error);
    return 1;
  }
  const { files } = written;
  mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  writeFileSync(REPORT_FILE, renderReport(build, files));
  const { dataset } = build;
  console.log(
    `matches ${dataset.matches.length}, competitions ${dataset.competitions.length}, ` +
      `clubs ${dataset.clubs.length}, players ${dataset.players.length}, ` +
      `left out ${build.left.length}`,
  );
  console.log(`dataset -> ${DATA_DIRS.dataset} (${files.size} files)`);
  console.log(`report -> ${REPORT_FILE}`);
  return 0;
}

process.exitCode = main();
