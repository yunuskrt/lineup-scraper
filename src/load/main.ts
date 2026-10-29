import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { DATA_DIRS } from '@/config/data-dirs.js';
import type { LoadTarget } from '@/config/env.schema.js';
import { loadEnv } from '@/config/load-env.js';
import { formatEnvIssues } from '@/config/parse-env.js';
import { createPrismaClient } from '@/db/client.js';
import type { DatasetInput } from '@/dataset/schema.js';
import { applyChunks } from '@/load/apply.js';
import { planChunks } from '@/load/chunks.js';
import {
  datasetImageKeys,
  missingImages,
  openTargetStore,
} from '@/load/images.js';
import { planLoad } from '@/load/plan.js';
import { preflight } from '@/load/preflight.js';
import { readStored } from '@/load/read.js';
import { changeCount, renderPlan, renderReport } from '@/load/report.js';
import { wantedRows } from '@/load/rows.js';
import { checkTarget, parseArgs, type LoadArgs } from '@/load/target.js';

const SCHEMA_FILE = new URL('../../prisma/schema.prisma', import.meta.url);

// Drift stops the run; only the verdict is shown
function schemaMatches(): boolean {
  const result = spawnSync('npm', ['run', '--silent', 'db:check'], {
    stdio: 'ignore',
  });
  return result.status === 0;
}

// Each key's object must be in the target's bucket
async function checkImages(
  target: LoadTarget,
  dataset: DatasetInput,
  args: LoadArgs,
): Promise<{ success: true } | { success: false; error: string }> {
  const keys = datasetImageKeys(dataset);
  if (keys.length === 0) return { success: true };
  const opened = openTargetStore(target, args);
  if (!opened.success) return opened;
  const missing = await missingImages(opened.store, keys);
  if (missing.length > 0) {
    return {
      success: false,
      error: `${missing.length} of ${keys.length} images aren't in the bucket: run npm run images -- --upload first`,
    };
  }
  console.log(`images: all ${keys.length} in the bucket`);
  return { success: true };
}

async function main(argv: string[]): Promise<number> {
  // tsx doesn't read .env itself
  if (existsSync('.env')) process.loadEnvFile('.env');
  const env = loadEnv();
  if (!env.success) {
    console.error(formatEnvIssues(env.error));
    return 1;
  }
  const args = parseArgs(argv);
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
  const mode = args.args.apply ? 'apply' : 'dry run';
  console.log(`target ${target}, ${mode}`);

  const checked = preflight(
    DATA_DIRS.dataset,
    readFileSync(SCHEMA_FILE, 'utf8'),
  );
  if (!checked.success) {
    console.error(checked.error);
    return 1;
  }
  if (!schemaMatches()) {
    console.error(
      'npm run db:check found drift: the schema copy and the database differ',
    );
    return 1;
  }
  console.log(
    'preflight: manifest, schema hash, dataset schema and db:check pass',
  );
  const images = await checkImages(target, checked.dataset, args.args);
  if (!images.success) {
    console.error(images.error);
    return 1;
  }

  const prisma = createPrismaClient(env.data, {
    allowProduction: guard.allowProduction,
  });
  try {
    const wanted = wantedRows(checked.dataset);
    const plan = planLoad(wanted, await readStored(prisma, wanted));
    for (const line of renderPlan(plan)) console.log(line);
    if (!args.args.apply) {
      console.log(
        `changes a load would make: ${changeCount(plan)} (nothing written)`,
      );
      return 0;
    }
    const chunks = planChunks(plan, wanted);
    const report = await applyChunks(prisma, chunks, (name) =>
      console.log(`committed: ${name}`),
    );
    for (const line of renderReport(report, plan)) console.log(line);
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    // Prisma's minimal format names no value
    console.error(
      `Load failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  },
);
