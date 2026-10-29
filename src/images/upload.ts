import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ImageEntry, ImageKeys } from '@/images/keys.js';
import type { ObjectStore } from '@/storage/client.js';
import { uploadImage } from '@/storage/upload.js';

export interface UploadCounts {
  uploaded: number;
  present: number;
}

export type UploadAllResult =
  { success: true; counts: UploadCounts } | { success: false; error: string };

// Every mapped file; its key must still match
export async function uploadAll(
  store: ObjectStore,
  keys: ImageKeys,
  workDir: string,
): Promise<UploadAllResult> {
  const counts: UploadCounts = { uploaded: 0, present: 0 };
  const jobs: ['crest' | 'player', ImageEntry][] = [
    ...keys.crests.map((e): ['crest', ImageEntry] => ['crest', e]),
    ...keys.photos.map((e): ['player', ImageEntry] => ['player', e]),
  ];
  for (const [kind, entry] of jobs) {
    const bytes = new Uint8Array(readFileSync(path.join(workDir, entry.key)));
    const result = await uploadImage(store, {
      kind,
      slug: entry.slug,
      bytes,
      contentType: 'image/webp',
      metadata: {
        slug: entry.slug,
        'transfermarkt-id': entry.transfermarktId,
      },
    });
    if (!result.success) return { success: false, error: result.error };
    if (result.key !== entry.key) {
      return {
        success: false,
        error: `${entry.key} changed on disk: run npm run images again`,
      };
    }
    counts[result.uploaded ? 'uploaded' : 'present'] += 1;
  }
  return { success: true, counts };
}
