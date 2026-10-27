import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { DATA_DIRS } from '@/config/data-dirs.js';
import { positionGroupSchema } from '@/dataset/enums.js';
import {
  failureText,
  gateMatches,
  type GateMatch,
  type GateSide,
} from '@/gate/gate.js';
import { renderReport } from '@/gate/report.js';
import { crosswalkSchema } from '@/resolve/curation.js';

const WORK = DATA_DIRS.work;
const LINEUPS_FILE = path.join(WORK, 'lineups', 'matches.json');
const ALIASES_FILE = path.join(WORK, 'aliases', 'players.json');
const SCORES_FILE = path.join(WORK, 'scores', 'matches.json');
const RESOLVED_FILE = path.join(WORK, 'resolved', 'matches.json');
const CROSSWALK_FILE = path.join(
  DATA_DIRS.curation,
  'crosswalk',
  'players.json',
);
const OUTPUT_FILE = path.join(WORK, 'gate', 'matches.json');
const REPORT_FILE = path.join(DATA_DIRS.reports, 'gate.md');

const lineupSideSchema = z.object({
  formation: z.string().nullable(),
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
    slug: z.string(),
    sides: z.object({ away: lineupSideSchema, home: lineupSideSchema }),
  }),
);
const aliasesSchema = z.array(
  z.strictObject({
    aliases: z.array(z.string()),
    slug: z.string(),
    transfermarktId: z.string(),
  }),
);
const starPowerSchema = z.object({ starPower: z.number() });
const scoresSchema = z.array(
  z.object({
    slug: z.string(),
    signals: z.object({
      sides: z.object({ away: starPowerSchema, home: starPowerSchema }),
    }),
  }),
);
const resolvedSchema = z.array(z.object({ slug: z.string() }));

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
  const inputs = [LINEUPS_FILE, ALIASES_FILE, SCORES_FILE, RESOLVED_FILE];
  for (const file of [...inputs, CROSSWALK_FILE]) {
    if (!existsSync(file)) {
      console.error(
        `Missing ${file}: run \`npm run lineups\`, \`npm run aliases\` and \`npm run scores\``,
      );
      return 1;
    }
  }
  const lineups = new Map(
    readJson(LINEUPS_FILE, lineupsSchema).map((m) => [m.slug, m.sides]),
  );
  const aliases = readJson(ALIASES_FILE, aliasesSchema);
  const players = {
    slugs: new Map(Object.entries(readJson(CROSSWALK_FILE, crosswalkSchema))),
    aliases: new Map(aliases.map((p) => [p.transfermarktId, p.aliases])),
  };
  const empty: GateSide = { formation: null, starters: [] };
  const matches: GateMatch[] = readJson(SCORES_FILE, scoresSchema).map(
    (score) => ({
      slug: score.slug,
      sides: lineups.get(score.slug) ?? { away: empty, home: empty },
      starPower: {
        away: score.signals.sides.away.starPower,
        home: score.signals.sides.home.starPower,
      },
    }),
  );
  const results = gateMatches(matches, players);
  const waiting = readJson(RESOLVED_FILE, resolvedSchema)
    .map((m) => m.slug)
    .filter((slug) => !lineups.has(slug))
    .toSorted();
  write(
    OUTPUT_FILE,
    `${JSON.stringify(
      results.map((r) => ({ ...r, failures: r.failures.map(failureText) })),
      null,
      2,
    )}\n`,
  );
  write(REPORT_FILE, renderReport(results, waiting));
  const failed = results.filter((r) => !r.passed).length;
  console.log(
    `matches checked ${results.length}, passed ${results.length - failed}, ` +
      `failed ${failed}, waiting for a match report ${waiting.length}`,
  );
  console.log(`gate -> ${OUTPUT_FILE}`);
  console.log(`report -> ${REPORT_FILE}`);
  return 0;
}

process.exitCode = main();
