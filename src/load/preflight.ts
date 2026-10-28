import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { MANIFEST, sha256 } from '@/dataset/files.js';
import { formatDatasetIssues } from '@/dataset/issues.js';
import { datasetSchema, type DatasetInput } from '@/dataset/schema.js';

const manifestSchema = z.object({
  files: z.record(z.string(), z.string()),
  schemaHash: z.string(),
});

export type Preflight =
  { success: true; dataset: DatasetInput } | { success: false; error: string };

// Every file under the folder, relative, sorted
function filesIn(dir: string, prefix = ''): string[] {
  return readdirSync(path.join(dir, prefix), { withFileTypes: true })
    .flatMap((entry) => {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      return entry.isDirectory() ? filesIn(dir, relative) : [relative];
    })
    .toSorted();
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, 'utf8'));
}

// The dataset from its files (S14's layout)
function assemble(dir: string, files: string[]): DatasetInput {
  const matches = files
    .filter((file) => file.startsWith('matches/'))
    .flatMap((file) => readJson(path.join(dir, file)) as unknown[]);
  return {
    competitions: readJson(path.join(dir, 'competitions.json')),
    clubs: readJson(path.join(dir, 'clubs.json')),
    players: readJson(path.join(dir, 'players.json')),
    matches,
  } as DatasetInput;
}

// Manifest, schema hash, dataset schema (D4)
export function preflight(dir: string, schemaText: string): Preflight {
  const fail = (error: string): Preflight => ({ success: false, error });
  const manifestFile = path.join(dir, MANIFEST);
  if (!existsSync(manifestFile))
    return fail(`No ${MANIFEST}: run npm run dataset`);
  let manifest: z.infer<typeof manifestSchema>;
  try {
    manifest = manifestSchema.parse(readJson(manifestFile));
  } catch {
    return fail(`Invalid ${MANIFEST}`);
  }
  if (manifest.schemaHash !== sha256(schemaText)) {
    return fail(
      'The dataset was built for another schema.prisma: run npm run dataset',
    );
  }
  const listed = Object.keys(manifest.files).toSorted();
  const onDisk = filesIn(dir).filter(
    (file) => file !== MANIFEST && file !== '.gitkeep',
  );
  const unlisted = onDisk.filter((file) => !listed.includes(file));
  if (unlisted.length > 0)
    return fail(`Not in the manifest: ${unlisted.join(', ')}`);
  for (const file of listed) {
    const at = path.join(dir, file);
    if (!existsSync(at)) return fail(`Missing ${file}`);
    if (sha256(readFileSync(at, 'utf8')) !== manifest.files[file]) {
      return fail(`${file} changed since the build: run npm run dataset`);
    }
  }
  let dataset: DatasetInput;
  try {
    dataset = assemble(dir, listed);
  } catch {
    return fail('A dataset file is not valid JSON');
  }
  const parsed = datasetSchema.safeParse(dataset);
  if (!parsed.success) return fail(formatDatasetIssues(parsed.error));
  return { success: true, dataset };
}
