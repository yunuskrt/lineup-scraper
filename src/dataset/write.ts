import {
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { datasetFiles } from '@/dataset/files.js';
import { formatDatasetIssues } from '@/dataset/issues.js';
import { datasetSchema, type DatasetInput } from '@/dataset/schema.js';

export type WriteResult =
  | { success: true; files: Map<string, string> }
  | { success: false; error: string };

// Built beside, then swapped in whole (D3)
function replaceDir(target: string, files: Map<string, string>): void {
  const staging = `${target}.build`;
  const previous = `${target}.previous`;
  rmSync(staging, { recursive: true, force: true });
  rmSync(previous, { recursive: true, force: true });
  for (const [file, text] of [...files, ['.gitkeep', '']] as const) {
    const at = path.join(staging, file);
    mkdirSync(path.dirname(at), { recursive: true });
    writeFileSync(at, text);
  }
  if (existsSync(target)) renameSync(target, previous);
  renameSync(staging, target);
  rmSync(previous, { recursive: true, force: true });
}

// Validated whole first: nothing is written otherwise
export function writeDataset(
  target: string,
  dataset: DatasetInput,
  schemaHash: string,
): WriteResult {
  const parsed = datasetSchema.safeParse(dataset);
  if (!parsed.success) {
    return { success: false, error: formatDatasetIssues(parsed.error) };
  }
  const files = datasetFiles(dataset, schemaHash);
  replaceDir(target, files);
  return { success: true, files };
}
