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
import { changedEntries, duplicateSlugs } from '@/resolve/slugs.js';
import { transfermarktMatchSchema } from '@/raw/transfermarkt-match.js';

const CROSSWALK_DIR = path.join(DATA_DIRS.curation, 'crosswalk');
const RESOLVED_DIR = path.join(DATA_DIRS.work, 'resolved');
const RAW_DIR = path.join(DATA_DIRS.raw, 'transfermarkt');
const ENTITIES = ['competitions', 'clubs', 'matches'] as const;
type Entity = (typeof ENTITIES)[number];

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

// Every name each club id was shown with
function readNames(): NameCounts {
  const names: NameCounts = new Map();
  const count = (id: string, name: string) => {
    const counts = names.get(id) ?? new Map<string, number>();
    counts.set(name, (counts.get(name) ?? 0) + 1);
    names.set(id, counts);
  };
  for (const { line, at } of ndjsonLines('fixture')) {
    const row = parseFixtureLine(line, at);
    count(row.home.sourceId, row.home.name);
    count(row.away.sourceId, row.away.name);
  }
  for (const { line, at } of ndjsonLines('match')) {
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      throw new Error(`Invalid JSON in match records: ${at}`);
    }
    const parsed = transfermarktMatchSchema.safeParse(value);
    if (!parsed.success) throw new Error(`Invalid match record: ${at}`);
    count(parsed.data.home.sourceId, parsed.data.home.name);
    count(parsed.data.away.sourceId, parsed.data.away.name);
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

function readCrosswalks(): { crosswalks: Crosswalks; problems: string[] } {
  const problems: string[] = [];
  const crosswalks: Crosswalks = {
    competitions: readCrosswalk('competitions', problems),
    clubs: readCrosswalk('clubs', problems),
    matches: readCrosswalk('matches', problems),
  };
  return { crosswalks, problems };
}

function write(file: string, value: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function main(): number {
  const { crosswalks, problems } = readCrosswalks();
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    console.error(
      'Slugs are permanent: restore the committed crosswalk entries.',
    );
    return 1;
  }
  const resolved = resolve({
    config: readPoolConfig(),
    matches: readJson(
      path.join(DATA_DIRS.work, 'pool', 'matches.json'),
      z.array(poolMatchSchema),
      [],
    ),
    names: readNames(),
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
  for (const entity of ENTITIES) {
    write(
      path.join(CROSSWALK_DIR, `${entity}.json`),
      resolved.crosswalks[entity],
    );
    write(path.join(RESOLVED_DIR, `${entity}.json`), resolved[entity]);
  }
  write(path.join(RESOLVED_DIR, 'seasons.json'), resolved.seasons);
  const report = path.join(DATA_DIRS.reports, 'resolve.md');
  mkdirSync(path.dirname(report), { recursive: true });
  writeFileSync(report, renderReport(resolved));
  const added = Object.values(resolved.added).reduce(
    (n, w) => n + Object.keys(w).length,
    0,
  );
  console.log(
    `competitions ${resolved.competitions.length}, seasons ${resolved.seasons.length}, ` +
      `clubs ${resolved.clubs.length}, matches ${resolved.matches.length}`,
  );
  console.log(
    `new slugs ${added}, held back ${resolved.held.length}, ` +
      `unmapped stages ${resolved.unmappedStages.length}, no slug ${resolved.unslugged.length}`,
  );
  console.log(`report -> ${report}`);
  return 0;
}

process.exitCode = main();
