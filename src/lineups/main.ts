import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { DATA_DIRS } from '@/config/data-dirs.js';
import { formationNamesSchema } from '@/lineups/formation.js';
import { extractLineups } from '@/lineups/lineups.js';
import { renderReport } from '@/lineups/report.js';
import { poolMatchesSchema } from '@/pool/build.js';
import { latest, readRecords } from '@/raw/read.js';
import { transfermarktMatchSchema } from '@/raw/transfermarkt-match.js';
import { resolvedMatchSchema } from '@/resolve/resolve.js';

const RESOLVED_FILE = path.join(DATA_DIRS.work, 'resolved', 'matches.json');
const POOL_FILE = path.join(DATA_DIRS.work, 'pool', 'matches.json');
const FORMATIONS_FILE = path.join(DATA_DIRS.curation, 'formations.json');
const OUTPUT_FILE = path.join(DATA_DIRS.work, 'lineups', 'matches.json');
const REPORT_FILE = path.join(DATA_DIRS.reports, 'lineups.md');

function readJson<T>(file: string, schema: z.ZodType<T>): T {
  return schema.parse(JSON.parse(readFileSync(file, 'utf8')));
}

function write(file: string, text: string): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
}

function main(): number {
  for (const file of [RESOLVED_FILE, POOL_FILE]) {
    if (!existsSync(file)) {
      console.error(
        `Missing ${file}: run \`npm run pool\` and \`npm run resolve\``,
      );
      return 1;
    }
  }
  const pool = readJson(POOL_FILE, poolMatchesSchema);
  const lineups = extractLineups({
    matches: readJson(RESOLVED_FILE, z.array(resolvedMatchSchema)),
    pool: new Map(pool.map((m) => [m.sourceId, m])),
    reports: latest(readRecords('match', transfermarktMatchSchema)),
    formationNames: existsSync(FORMATIONS_FILE)
      ? readJson(FORMATIONS_FILE, formationNamesSchema)
      : {},
  });
  write(OUTPUT_FILE, `${JSON.stringify(lineups.matches, null, 2)}\n`);
  write(REPORT_FILE, renderReport(lineups));
  console.log(
    `matches read ${lineups.matches.length}, waiting for a report ${lineups.waiting.length}, ` +
      `held back ${lineups.held.length}, sides not mapped ${lineups.sides.length}`,
  );
  console.log(
    `events with an unknown minute: ${lineups.unknownMinutes.length} match(es)`,
  );
  console.log(`lineups -> ${OUTPUT_FILE}`);
  console.log(`report -> ${REPORT_FILE}`);
  return 0;
}

process.exitCode = main();
