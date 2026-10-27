import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { buildAliases, type PlayerNames } from '@/aliases/build.js';
import { aliasCurationSchema } from '@/aliases/curation.js';
import { renderReport } from '@/aliases/report.js';
import { checkXis, type XiSide } from '@/aliases/xi.js';
import { DATA_DIRS } from '@/config/data-dirs.js';
import { playerAliasesSchema } from '@/dataset/schema.js';
import { latest, readRecords } from '@/raw/read.js';
import { transfermarktPlayerSchema } from '@/raw/transfermarkt-player.js';

const PLAYERS_FILE = path.join(DATA_DIRS.work, 'resolved', 'players.json');
const LINEUPS_FILE = path.join(DATA_DIRS.work, 'lineups', 'matches.json');
const CURATION_FILE = path.join(DATA_DIRS.curation, 'aliases.json');
const OUTPUT_FILE = path.join(DATA_DIRS.work, 'aliases', 'players.json');
const REPORT_FILE = path.join(DATA_DIRS.reports, 'aliases.md');

const resolvedPlayersSchema = z.array(
  z.strictObject({
    aliasCandidates: z.array(z.string()),
    name: z.string(),
    slug: z.string(),
    transfermarktId: z.string(),
  }),
);

const startersSchema = z.object({
  starters: z.array(z.object({ transfermarktId: z.string() })),
});
const lineupMatchesSchema = z.array(
  z.object({
    slug: z.string(),
    sides: z.object({ home: startersSchema, away: startersSchema }),
  }),
);

// Names the file and the path, never a value
function readJson<T>(file: string, schema: z.ZodType<T>): T {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    // Node's message can quote the file's text
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

function playerNames(): PlayerNames[] {
  const pages = latest(readRecords('player', transfermarktPlayerSchema));
  return readJson(PLAYERS_FILE, resolvedPlayersSchema).map((player) => {
    const page = pages.get(player.transfermarktId);
    if (!page) {
      throw new Error(`No player page for spieler ${player.transfermarktId}`);
    }
    return {
      ...player,
      fullName: page.fullName,
      nameInHomeCountry: page.nameInHomeCountry,
    };
  });
}

function xiSides(): XiSide[] {
  return readJson(LINEUPS_FILE, lineupMatchesSchema).flatMap((match) =>
    (['home', 'away'] as const).map((side) => ({
      match: match.slug,
      side,
      starters: match.sides[side].starters.map((s) => s.transfermarktId),
    })),
  );
}

function main(): number {
  for (const file of [PLAYERS_FILE, LINEUPS_FILE]) {
    if (!existsSync(file)) {
      console.error(
        `Missing ${file}: run \`npm run resolve\` and \`npm run lineups\``,
      );
      return 1;
    }
  }
  const curation = existsSync(CURATION_FILE)
    ? readJson(CURATION_FILE, aliasCurationSchema)
    : {};
  const sets = buildAliases(playerNames(), curation);
  for (const player of sets.players) {
    if (!playerAliasesSchema.safeParse(player.aliases).success) {
      throw new Error(`Aliases of ${player.slug} fail the dataset rules`);
    }
  }
  const xis = checkXis(
    xiSides(),
    new Map(sets.players.map((p) => [p.transfermarktId, p])),
  );
  write(OUTPUT_FILE, `${JSON.stringify(sets.players, null, 2)}\n`);
  write(REPORT_FILE, renderReport(sets, xis));
  const kept = Object.values(sets.kept).reduce((sum, n) => sum + n, 0);
  console.log(
    `players ${sets.players.length}, aliases ${kept}, names dropped ${sets.dropped.length}, ` +
      `curation warnings ${sets.warnings.length}`,
  );
  console.log(
    `inside an XI: shared ${xis.shared.length}, fuzzy ${xis.fuzzy.length}, ` +
      `unrevealable ${xis.unrevealable.length}, no aliases ${xis.missing.length}`,
  );
  console.log(`aliases -> ${OUTPUT_FILE}`);
  console.log(`report -> ${REPORT_FILE}`);
  return 0;
}

process.exitCode = main();
