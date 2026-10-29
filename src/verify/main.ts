import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DATA_DIRS } from '@/config/data-dirs.js';
import { loadEnv } from '@/config/load-env.js';
import { formatEnvIssues } from '@/config/parse-env.js';
import { createPrismaClient } from '@/db/client.js';
import { MANIFEST } from '@/dataset/files.js';
import { missingImages, openTargetStore } from '@/load/images.js';
import { preflight } from '@/load/preflight.js';
import { checkTarget } from '@/load/target.js';
import { parseVerifyArgs } from '@/verify/args.js';
import {
  countsSchema,
  storedImageKeys,
  verifyState,
  type Expected,
  type Failure,
} from '@/verify/check.js';
import { readState } from '@/verify/read.js';

const SCHEMA_FILE = new URL('../../prisma/schema.prisma', import.meta.url);

function manifestCounts() {
  const file = path.join(DATA_DIRS.dataset, MANIFEST);
  const manifest: unknown = JSON.parse(readFileSync(file, 'utf8'));
  return countsSchema.parse((manifest as { counts?: unknown }).counts);
}

async function main(argv: string[]): Promise<number> {
  // tsx doesn't read .env itself
  if (existsSync('.env')) process.loadEnvFile('.env');
  const env = loadEnv();
  if (!env.success) {
    console.error(formatEnvIssues(env.error));
    return 1;
  }
  const args = parseVerifyArgs(argv);
  if (!args.success) {
    console.error(args.error);
    return 2;
  }
  const target = env.data.LOAD_TARGET;
  const guard = checkTarget(target, args.args);
  if (!guard.success) {
    console.error(guard.error);
    return 1;
  }
  console.log(`target ${target}, read only`);
  const checked = preflight(
    DATA_DIRS.dataset,
    readFileSync(SCHEMA_FILE, 'utf8'),
  );
  if (!checked.success) {
    console.error(checked.error);
    return 1;
  }
  const { dataset } = checked;
  const expected: Expected = {
    competitions: dataset.competitions.map((c) => c.slug),
    clubs: dataset.clubs.map((c) => c.slug),
    players: dataset.players.map((p) => p.slug),
    matches: dataset.matches.map((m) => m.slug),
    counts: manifestCounts(),
  };

  const prisma = createPrismaClient(env.data, {
    allowProduction: guard.allowProduction,
  });
  let failures: Failure[];
  let keys: string[];
  try {
    const state = await readState(prisma, expected);
    failures = verifyState(state, expected);
    keys = storedImageKeys(state);
  } finally {
    await prisma.$disconnect();
  }

  if (keys.length > 0) {
    const opened = openTargetStore(target, args.args);
    if (!opened.success) {
      console.error(opened.error);
      return 1;
    }
    const absent = await missingImages(opened.store, keys);
    if (absent.length > 0) {
      failures.push({
        subject: 'images',
        rule: `${absent.length} of ${keys.length} keys have no object`,
      });
    }
  }

  const counts = Object.entries(expected.counts)
    .map(([key, n]) => `${key} ${n}`)
    .join(', ');
  console.log(`expected: ${counts}`);
  console.log(`images: ${keys.length} keys checked in the bucket`);
  for (const { subject, rule } of failures) {
    console.error(`FAIL ${subject}: ${rule}`);
  }
  if (failures.length > 0) {
    console.error(`verify: ${failures.length} failures`);
    return 1;
  }
  console.log(
    `verify: all ${expected.matches.length} matches servable and playable`,
  );
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    // Prisma's minimal format names no value
    console.error(
      `Verify failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  },
);
