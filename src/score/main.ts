import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { DATA_DIRS } from '@/config/data-dirs.js';
import {
  competitionKindSchema,
  matchEventKindSchema,
  sideSchema,
} from '@/dataset/enums.js';
import { latest, readRecords } from '@/raw/read.js';
import { transfermarktMatchSchema } from '@/raw/transfermarkt-match.js';
import { transfermarktPlayerSchema } from '@/raw/transfermarkt-player.js';
import { resolvedMatchSchema } from '@/resolve/resolve.js';
import { renderReport, type ScoredMatch } from '@/score/report.js';
import { scoreMatches, type ScoreInput } from '@/score/score.js';
import { readCaps } from '@/score/signals.js';

const RESOLVED_DIR = path.join(DATA_DIRS.work, 'resolved');
const LINEUPS_FILE = path.join(DATA_DIRS.work, 'lineups', 'matches.json');
const OUTPUT_FILE = path.join(DATA_DIRS.work, 'scores', 'matches.json');
const REPORT_FILE = path.join(DATA_DIRS.reports, 'scores.md');

const competitionsSchema = z.array(
  z.object({ slug: z.string(), kind: competitionKindSchema }),
);

const scoreSchema = z.strictObject({ away: z.number(), home: z.number() });
const sideSchemaOf = z.object({
  goals: z.number().int().nonnegative(),
  starters: z.array(z.object({ transfermarktId: z.string() })),
});
const lineupMatchesSchema = z.array(
  z.object({
    events: z.array(
      z.strictObject({
        addedTime: z.number().nullable(),
        kind: matchEventKindSchema,
        minute: z.number().nullable(),
        player: z.string().nullable(),
        side: sideSchema,
      }),
    ),
    extraTime: z.boolean(),
    halfTime: scoreSchema.nullable(),
    shootout: scoreSchema.nullable(),
    sides: z.object({ away: sideSchemaOf, home: sideSchemaOf }),
    slug: z.string(),
    transfermarktId: z.string(),
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

function write(file: string, text: string): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
}

function main(): number {
  const resolvedFile = path.join(RESOLVED_DIR, 'matches.json');
  for (const file of [resolvedFile, LINEUPS_FILE]) {
    if (!existsSync(file)) {
      console.error(
        `Missing ${file}: run \`npm run resolve\` and \`npm run lineups\``,
      );
      return 1;
    }
  }
  const resolved = new Map(
    readJson(resolvedFile, z.array(resolvedMatchSchema)).map((m) => [
      m.slug,
      m,
    ]),
  );
  const kinds = new Map(
    readJson(
      path.join(RESOLVED_DIR, 'competitions.json'),
      competitionsSchema,
    ).map((c) => [c.slug, c.kind]),
  );
  const lineups = readJson(LINEUPS_FILE, lineupMatchesSchema);
  const reports = latest(readRecords('match', transfermarktMatchSchema));
  const pages = latest(readRecords('player', transfermarktPlayerSchema));

  const inputs: ScoreInput[] = [];
  const matches: ScoredMatch[] = [];
  const fetched: string[] = [];
  for (const lineup of lineups) {
    const match = resolved.get(lineup.slug);
    const kind = match ? kinds.get(match.competition) : undefined;
    if (!match || !kind) {
      throw new Error(`${lineup.slug}: not a resolved match`);
    }
    const starters = {
      home: lineup.sides.home.starters.map((s) => s.transfermarktId),
      away: lineup.sides.away.starters.map((s) => s.transfermarktId),
    };
    inputs.push({
      slug: lineup.slug,
      kind,
      seasonStart: Number(match.season.slice(0, 4)),
      stage: match.stage,
      groups: match.groups,
      starters,
      goals: { home: lineup.sides.home.goals, away: lineup.sides.away.goals },
      halfTime: lineup.halfTime,
      extraTime: lineup.extraTime,
      shootout: lineup.shootout,
      events: lineup.events,
    });
    matches.push({ slug: lineup.slug, kind, groups: match.groups });
    const report = reports.get(lineup.transfermarktId);
    if (report) fetched.push(report.fetchedAt);
    for (const id of [...starters.home, ...starters.away]) {
      const page = pages.get(id);
      if (page) fetched.push(page.fetchedAt);
    }
  }
  const caps = new Map(
    [...pages].map(([id, page]) => [id, readCaps(page.capsGoals)]),
  );
  // From the sources, never the clock (D4)
  const computedAt = fetched.toSorted().at(-1) ?? '1970-01-01T00:00:00Z';
  const result = scoreMatches(inputs, caps, computedAt);
  write(OUTPUT_FILE, `${JSON.stringify(result.scores, null, 2)}\n`);
  write(REPORT_FILE, renderReport(matches, result));
  console.log(
    `matches scored ${result.scores.length}, starters without a player page ${result.missing.length}`,
  );
  console.log(`scores -> ${OUTPUT_FILE}`);
  console.log(`report -> ${REPORT_FILE}`);
  return 0;
}

process.exitCode = main();
