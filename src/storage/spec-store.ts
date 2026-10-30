import type { ObjectStore } from '@/storage/client.js';

export interface StoredObject {
  body: Uint8Array;
  contentType: string;
  metadata: Record<string, string>;
}

// A bucket in memory, for specs
export function memoryStore() {
  const objects = new Map<string, StoredObject>();
  let puts = 0;
  const store: ObjectStore = {
    checkBucket: () => Promise.resolve(),
    hasObject: (key) => Promise.resolve(objects.has(key)),
    putObject: (key, body, contentType, metadata = {}) => {
      puts += 1;
      objects.set(key, { body, contentType, metadata });
      return Promise.resolve();
    },
    countObjects: (prefix) =>
      Promise.resolve(
        [...objects.keys()].filter((k) => k.startsWith(prefix)).length,
      ),
    listKeys: (prefix) =>
      Promise.resolve(
        [...objects.keys()].filter((k) => k.startsWith(prefix)).toSorted(),
      ),
    measure: (prefix) => {
      const mine = [...objects].filter(([k]) => k.startsWith(prefix));
      const bytes = mine.reduce((sum, [, o]) => sum + o.body.byteLength, 0);
      return Promise.resolve({ objects: mine.length, bytes });
    },
    readMetadata: (key) => Promise.resolve(objects.get(key)?.metadata ?? null),
  };
  return { store, objects, puts: () => puts };
}
