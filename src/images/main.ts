import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { DATA_DIRS } from '@/config/data-dirs.js';
import { loadEnv, loadStorageEnv } from '@/config/load-env.js';
import { formatEnvIssues } from '@/config/parse-env.js';
import { buildDataset } from '@/dataset/build.js';
import { missingSources, readSources } from '@/dataset/sources.js';
import { readImageCuration, readLogoStyles } from '@/images/curation.js';
import { IMAGES_WORK, KEYS_FILE, readImageKeys } from '@/images/keys.js';
import { processImages } from '@/images/process.js';
import { renderReport, renderSheet } from '@/images/report.js';
import { parseImageArgs } from '@/images/args.js';
import { uploadAll } from '@/images/upload.js';
import type { LoadArgs } from '@/load/target.js';
import { crosswalkSchema } from '@/resolve/curation.js';
import { createObjectStore } from '@/storage/client.js';
import { checkStorageTarget } from '@/storage/target.js';

const REPORT_FILE = path.join(DATA_DIRS.reports, 'images.md');
const SHEET_FILE = path.join(DATA_DIRS.reports, 'images.html');
const COMPETITIONS = path.join(
  DATA_DIRS.curation,
  'crosswalk',
  'competitions.json',
);

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

// Slug → Transfermarkt code
function competitionCodes(): Map<string, string> {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(COMPETITIONS, 'utf8'));
  } catch {
    throw new Error('Invalid JSON in crosswalk/competitions.json');
  }
  const parsed = crosswalkSchema.safeParse(value);
  if (!parsed.success) throw new Error('Invalid crosswalk/competitions.json');
  const codes = Object.entries(parsed.data);
  return new Map(codes.map(([code, slug]) => [slug, code]));
}

// Offline: the dataset's images
async function build(): Promise<number> {
  const missing = missingSources();
  if (missing !== null) {
    console.error(missing);
    return 1;
  }
  const { dataset } = buildDataset(readSources());
  const codes = competitionCodes();
  const competitions = dataset.competitions.flatMap((c) => {
    const code = codes.get(c.slug);
    return code ? [{ slug: c.slug, transfermarktCode: code }] : [];
  });
  const processed = await processImages(
    dataset.clubs,
    dataset.players,
    DATA_DIRS.images,
    readImageCuration(),
    competitions,
    readLogoStyles(),
  );
  // Only this run's files remain
  rmSync(IMAGES_WORK, { recursive: true, force: true });
  for (const made of processed.made) {
    const file = path.join(IMAGES_WORK, made.entry.key);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, made.bytes);
  }
  mkdirSync(IMAGES_WORK, { recursive: true });
  writeFileSync(KEYS_FILE, json(processed.keys));
  mkdirSync(DATA_DIRS.reports, { recursive: true });
  writeFileSync(REPORT_FILE, renderReport(processed));
  writeFileSync(SHEET_FILE, renderSheet(processed));
  console.log(
    `crests ${processed.keys.crests.length}, photos ${processed.keys.photos.length}, ` +
      `logos ${processed.keys.logos.length}, missing ${processed.missing.length}, ` +
      `below the size floor ${processed.small.length}, ` +
      `dark logos ${processed.dark.length}`,
  );
  console.log(`images -> ${IMAGES_WORK}`);
  console.log(`check them -> ${SHEET_FILE}`);
  return 0;
}

async function upload(args: LoadArgs): Promise<number> {
  // tsx doesn't read .env itself
  if (existsSync('.env')) process.loadEnvFile('.env');
  const env = loadEnv();
  const storageEnv = loadStorageEnv();
  if (!env.success || !storageEnv.success) {
    console.error(
      formatEnvIssues([
        ...(env.success ? [] : env.error),
        ...(storageEnv.success ? [] : storageEnv.error),
      ]),
    );
    return 1;
  }
  const target = env.data.LOAD_TARGET;
  const guard = checkStorageTarget(
    target,
    storageEnv.data.AWS_ENDPOINT_URL_S3,
    args,
  );
  if (!guard.success) {
    console.error(guard.error);
    return 1;
  }
  if (!existsSync(KEYS_FILE)) {
    console.error('No images to upload: run npm run images first');
    return 1;
  }
  const store = createObjectStore(storageEnv.data);
  await store.checkBucket();
  const result = await uploadAll(store, readImageKeys(), IMAGES_WORK);
  if (!result.success) {
    console.error(result.error);
    return 1;
  }
  const { uploaded, present } = result.counts;
  console.log(
    `target ${target}, bucket ${storageEnv.data.STORAGE_BUCKET}: ` +
      `uploaded ${uploaded}, already uploaded, skipping: ${present}`,
  );
  return 0;
}

async function main(argv: string[]): Promise<number> {
  const args = parseImageArgs(argv);
  if (!args.success) {
    console.error(args.error);
    return 2;
  }
  return args.args.apply ? upload(args.args) : build();
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    // A message or the SDK's name, never a value
    console.error(
      `Images failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
    process.exitCode = 1;
  },
);
