import type { DatasetInput } from '@/dataset/schema.js';
import type { ObjectStore } from '@/storage/client.js';
import { IMAGE_PREFIXES } from '@/storage/keys.js';

// Every image key the dataset would write
export function datasetImageKeys(dataset: DatasetInput): string[] {
  return [
    ...dataset.clubs.flatMap((c) => (c.crestKey ? [c.crestKey] : [])),
    ...dataset.players.flatMap((p) => (p.imageKey ? [p.imageKey] : [])),
  ].toSorted();
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
