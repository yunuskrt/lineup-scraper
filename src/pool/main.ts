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
import {
  buildPool,
  matchListSchema,
  parseFixtureLine,
  renderMatches,
  type MatchList,
} from '@/pool/build.js';
import { readPoolConfig } from '@/pool/config.js';
import { poolRules } from '@/pool/groups.js';
import { renderReport, type ListingState } from '@/pool/report.js';
import type { TransfermarktFixture } from '@/raw/transfermarkt-fixture.js';

const FIXTURE_DIR = path.join(DATA_DIRS.raw, 'transfermarkt', 'fixture');
const LISTINGS_FILE = path.join(
  DATA_DIRS.work,
  'link-lists',
  's07-listings.json',
);
const MATCHES_FILE = path.join(DATA_DIRS.work, 'pool', 'matches.json');
const REPORT_FILE = path.join(DATA_DIRS.reports, 'pool.md');

const listingEntrySchema = z.looseObject({ kind: z.string(), key: z.string() });

function readFixtures(): TransfermarktFixture[] {
  if (!existsSync(FIXTURE_DIR)) return [];
  const files = readdirSync(FIXTURE_DIR)
    .filter((f) => f.endsWith('.ndjson'))
    .toSorted();
  return files.flatMap((file) =>
    readFileSync(path.join(FIXTURE_DIR, file), 'utf8')
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line, index) => parseFixtureLine(line, `${file}:${index + 1}`)),
  );
}

// An absent list is empty
function readMatchList(name: string): MatchList {
  const file = path.join(DATA_DIRS.curation, name);
  if (!existsSync(file)) return [];
  return matchListSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
}

function readListings(): ListingState | null {
  if (!existsSync(LISTINGS_FILE)) return null;
  const entries = z
    .array(listingEntrySchema)
    .parse(JSON.parse(readFileSync(LISTINGS_FILE, 'utf8')));
  const isStored = (kind: string, key: string) =>
    existsSync(
      path.join(DATA_DIRS.pages, 'transfermarkt', kind, `${key}.html`),
    );
  return {
    total: entries.length,
    unsaved: entries.filter((e) => !isStored(e.kind, e.key)).map((e) => e.key),
  };
}

function write(file: string, text: string): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
}

function main(): number {
  const rows = readFixtures();
  const build = buildPool(
    rows,
    poolRules(readPoolConfig()),
    readMatchList('pool-include.json'),
    readMatchList('excluded-matches.json'),
  );
  const listings = readListings();
  write(MATCHES_FILE, renderMatches(build.matches));
  write(REPORT_FILE, renderReport(build, listings));
  console.log(`fixture rows: ${rows.length}`);
  console.log(`pool matches: ${build.matches.length} -> ${MATCHES_FILE}`);
  console.log(
    `conflicts: ${build.conflicts.length}, excluded: ${build.excluded.length}`,
  );
  if (listings) {
    console.log(
      `listing pages saved: ${listings.total - listings.unsaved.length}/${listings.total}`,
    );
  }
  console.log(`report -> ${REPORT_FILE}`);
  return build.conflicts.length > 0 ? 1 : 0;
}

process.exitCode = main();
