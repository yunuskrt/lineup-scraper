import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { DATA_DIRS } from '@/config/data-dirs.js';
import { parseFixtureLine, poolMatchSchema } from '@/pool/build.js';
import { readPoolConfig } from '@/pool/config.js';
import type { NameCounts } from '@/resolve/clubs.js';
import {
  clubNamesSchema,
  crosswalkSchema,
  stageNamesSchema,
  type Crosswalk,
} from '@/resolve/curation.js';
import { renderReport } from '@/resolve/report.js';
import { resolve, type Crosswalks } from '@/resolve/resolve.js';
import { resolvePlayers } from '@/resolve/players.js';
import { changedEntries, duplicateSlugs } from '@/resolve/slugs.js';
import type { TransfermarktFixture } from '@/raw/transfermarkt-fixture.js';
import {
  transfermarktMatchSchema,
  type TransfermarktMatch,
} from '@/raw/transfermarkt-match.js';
import { transfermarktPlayerSchema } from '@/raw/transfermarkt-player.js';

const CROSSWALK_DIR = path.join(DATA_DIRS.curation, 'crosswalk');
const RESOLVED_DIR = path.join(DATA_DIRS.work, 'resolved');
const RAW_DIR = path.join(DATA_DIRS.raw, 'transfermarkt');
const ENTITIES = ['competitions', 'clubs', 'matches'] as const;
type Entity = (typeof ENTITIES)[number] | 'players';

function readJson<T>(file: string, schema: z.ZodType<T>, fallback: T): T {
  if (!existsSync(file)) return fallback;
  return schema.parse(JSON.parse(readFileSync(file, 'utf8')));
}

function ndjsonLines(kind: string): { line: string; at: string }[] {
  const dir = path.join(RAW_DIR, kind);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.ndjson'))
    .toSorted()
    .flatMap((file) =>
      readFileSync(path.join(dir, file), 'utf8')
        .split('\n')
        .map((line, i) => ({ line, at: `${kind}/${file}:${i + 1}` }))
        .filter(({ line }) => line.trim() !== ''),
    );
}

// Names the file and line, never the record
function readRecords<T>(kind: string, schema: z.ZodType<T>): T[] {
  return ndjsonLines(kind).map(({ line, at }) => {
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      throw new Error(`Invalid JSON in ${kind} records: ${at}`);
    }
    const parsed = schema.safeParse(value);
    if (!parsed.success) throw new Error(`Invalid ${kind} record: ${at}`);
    return parsed.data;
  });
}

// The latest saved copy of each page
function latest<T extends { sourceId: string; fetchedAt: string }>(
  records: T[],
): Map<string, T> {
  const byId = new Map<string, T>();
  for (const record of records) {
    const kept = byId.get(record.sourceId);
    if (!kept || record.fetchedAt > kept.fetchedAt)
      byId.set(record.sourceId, record);
  }
  return byId;
}

// Every name each club id was shown with
function readNames(
  fixtures: TransfermarktFixture[],
  reports: TransfermarktMatch[],
): NameCounts {
  const names: NameCounts = new Map();
  const count = (id: string, name: string) => {
    const counts = names.get(id) ?? new Map<string, number>();
    counts.set(name, (counts.get(name) ?? 0) + 1);
    names.set(id, counts);
  };
  for (const { home, away } of [...fixtures, ...reports]) {
    count(home.sourceId, home.name);
    count(away.sourceId, away.name);
  }
  return names;
}

// The crosswalk as last committed; null if never committed
function committedCrosswalk(file: string): Crosswalk | null {
  const relative = path.relative(process.cwd(), file);
  try {
    // `./` makes the path relative to cwd, not the repo root
    const text = execFileSync('git', ['show', `HEAD:./${relative}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return crosswalkSchema.parse(JSON.parse(text));
  } catch {
    return null;
  }
}

function readCrosswalk(entity: Entity, problems: string[]): Crosswalk {
  const file = path.join(CROSSWALK_DIR, `${entity}.json`);
  const current = readJson(file, crosswalkSchema, {});
  const committed = committedCrosswalk(file);
  for (const key of committed ? changedEntries(committed, current) : []) {
    problems.push(
      `crosswalk/${entity}.json: committed entry \`${key}\` was changed or removed`,
    );
  }
  for (const slug of duplicateSlugs(current)) {
    problems.push(`crosswalk/${entity}.json: slug \`${slug}\` is used twice`);
  }
  return current;
}

function readCrosswalks(): {
  crosswalks: Crosswalks;
  players: Crosswalk;
  problems: string[];
} {
  const problems: string[] = [];
  const crosswalks: Crosswalks = {
    competitions: readCrosswalk('competitions', problems),
    clubs: readCrosswalk('clubs', problems),
    matches: readCrosswalk('matches', problems),
  };
  return { crosswalks, players: readCrosswalk('players', problems), problems };
}

function write(file: string, value: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function main(): number {
  const { crosswalks, players: playerWalk, problems } = readCrosswalks();
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    console.error(
      'Slugs are permanent: restore the committed crosswalk entries.',
    );
    return 1;
  }
  const fixtures = ndjsonLines('fixture').map(({ line, at }) =>
    parseFixtureLine(line, at),
  );
  const reports = latest(readRecords('match', transfermarktMatchSchema));
  const resolved = resolve({
    config: readPoolConfig(),
    matches: readJson(
      path.join(DATA_DIRS.work, 'pool', 'matches.json'),
      z.array(poolMatchSchema),
      [],
    ),
    names: readNames(fixtures, [...reports.values()]),
    clubNames: readJson(
      path.join(DATA_DIRS.curation, 'club-names.json'),
      clubNamesSchema,
      {},
    ),
    stageNames: readJson(
      path.join(DATA_DIRS.curation, 'stage-names.json'),
      stageNamesSchema,
      {
        stages: {},
        rounds: [],
      },
    ),
    crosswalks,
  });
  // Only the pool's players: its resolved matches' reports
  const poolReports = resolved.matches.flatMap(
    (m) => reports.get(m.transfermarktId) ?? [],
  );
  const players = resolvePlayers(
    poolReports,
    latest(readRecords('player', transfermarktPlayerSchema)),
    playerWalk,
  );
  for (const entity of ENTITIES) {
    write(
      path.join(CROSSWALK_DIR, `${entity}.json`),
      resolved.crosswalks[entity],
    );
    write(path.join(RESOLVED_DIR, `${entity}.json`), resolved[entity]);
  }
  write(path.join(CROSSWALK_DIR, 'players.json'), players.crosswalk);
  write(path.join(RESOLVED_DIR, 'players.json'), players.players);
  write(path.join(RESOLVED_DIR, 'seasons.json'), resolved.seasons);
  const report = path.join(DATA_DIRS.reports, 'resolve.md');
  mkdirSync(path.dirname(report), { recursive: true });
  writeFileSync(report, renderReport(resolved, players));
  const added =
    Object.values(resolved.added).reduce(
      (n, w) => n + Object.keys(w).length,
      0,
    ) + Object.keys(players.added).length;
  console.log(
    `competitions ${resolved.competitions.length}, seasons ${resolved.seasons.length}, ` +
      `clubs ${resolved.clubs.length}, matches ${resolved.matches.length}, ` +
      `players ${players.players.length}`,
  );
  console.log(
    `new slugs ${added}, held back ${resolved.held.length}, ` +
      `unmapped stages ${resolved.unmappedStages.length}, ` +
      `no slug ${resolved.unslugged.length + players.unslugged.length}, ` +
      `starters waiting for a player page ${players.waiting.length}`,
  );
  console.log(`report -> ${report}`);
  return 0;
}

process.exitCode = main();
