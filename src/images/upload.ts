import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ImageEntry, ImageKeys } from '@/images/keys.js';
import type { ObjectStore } from '@/storage/client.js';
import type { ImageKind } from '@/storage/keys.js';
import { uploadImage } from '@/storage/upload.js';

export interface UploadCounts {
  uploaded: number;
  present: number;
}

// The kind, the entry, and where it came from
type Job = [ImageKind, { key: string; slug: string }, Record<string, string>];

export type UploadAllResult =
  { success: true; counts: UploadCounts } | { success: false; error: string };

// Every mapped file; its key must still match
export async function uploadAll(
  store: ObjectStore,
  keys: ImageKeys,
  workDir: string,
): Promise<UploadAllResult> {
  const counts: UploadCounts = { uploaded: 0, present: 0 };
  const byId = (e: ImageEntry) => ({ 'transfermarkt-id': e.transfermarktId });
  const jobs: Job[] = [
    ...keys.crests.map((e): Job => ['crest', e, byId(e)]),
    ...keys.photos.map((e): Job => ['player', e, byId(e)]),
    ...keys.logos.map((e): Job => [
      'competition',
      e,
      { 'transfermarkt-code': e.transfermarktCode },
    ]),
  ];
  for (const [kind, entry, source] of jobs) {
    const bytes = new Uint8Array(readFileSync(path.join(workDir, entry.key)));
    const result = await uploadImage(store, {
      kind,
      slug: entry.slug,
      bytes,
      contentType: 'image/webp',
      metadata: { slug: entry.slug, ...source },
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
