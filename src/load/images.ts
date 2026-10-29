import type { LoadTarget } from '@/config/env.schema.js';
import { loadStorageEnv } from '@/config/load-env.js';
import { formatEnvIssues } from '@/config/parse-env.js';
import type { DatasetInput } from '@/dataset/schema.js';
import type { LoadArgs } from '@/load/target.js';
import { createObjectStore, type ObjectStore } from '@/storage/client.js';
import { IMAGE_PREFIXES } from '@/storage/keys.js';
import { checkStorageTarget } from '@/storage/target.js';

export type StoreResult =
  { success: true; store: ObjectStore } | { success: false; error: string };

// Every image key the dataset would write
export function datasetImageKeys(dataset: DatasetInput): string[] {
  return [
    ...dataset.clubs.flatMap((c) => (c.crestKey ? [c.crestKey] : [])),
    ...dataset.players.flatMap((p) => (p.imageKey ? [p.imageKey] : [])),
  ].toSorted();
}

// The target's bucket, behind S17's guard
export function openTargetStore(
  target: LoadTarget,
  args: LoadArgs,
): StoreResult {
  const storageEnv = loadStorageEnv();
  if (!storageEnv.success) {
    return { success: false, error: formatEnvIssues(storageEnv.error) };
  }
  const guard = checkStorageTarget(
    target,
    storageEnv.data.AWS_ENDPOINT_URL_S3,
    args,
  );
  if (!guard.success) return guard;
  return { success: true, store: createObjectStore(storageEnv.data) };
}

// Keys with no object yet: upload before load
export async function missingImages(
  store: ObjectStore,
  keys: readonly string[],
): Promise<string[]> {
  const stored = new Set<string>();
  for (const prefix of Object.values(IMAGE_PREFIXES)) {
    for (const key of await store.listKeys(`${prefix}/`)) stored.add(key);
  }
  return keys.filter((key) => !stored.has(key));
}
