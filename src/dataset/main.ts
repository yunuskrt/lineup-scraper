import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DATA_DIRS } from '@/config/data-dirs.js';
import { buildDataset } from '@/dataset/build.js';
import { sha256 } from '@/dataset/files.js';
import { renderReport } from '@/dataset/report.js';
import { missingSources, readSources } from '@/dataset/sources.js';
import { writeDataset } from '@/dataset/write.js';

const SCHEMA_FILE = new URL('../../prisma/schema.prisma', import.meta.url);
const REPORT_FILE = path.join(DATA_DIRS.reports, 'dataset.md');

function main(): number {
  const missing = missingSources();
  if (missing !== null) {
    console.error(missing);
    return 1;
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
