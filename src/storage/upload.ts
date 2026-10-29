import { imageKey, type ImageKind } from '@/storage/keys.js';
import type { ObjectStore } from '@/storage/client.js';

export type ImageUpload = {
  kind: ImageKind;
  slug: string;
  bytes: Uint8Array;
  contentType: string;
  // Leads an object back to its row
  metadata?: Record<string, string>;
};

export type UploadResult =
  | { success: true; key: string; uploaded: boolean }
  | { success: false; error: string };

// Same bytes, same key: a rerun uploads nothing
export async function uploadImage(
  store: ObjectStore,
  { kind, slug, bytes, contentType, metadata }: ImageUpload,
): Promise<UploadResult> {
  const named = imageKey(kind, slug, bytes, contentType);
  if (!named.success) return named;
  if (await store.hasObject(named.key)) {
    return { success: true, key: named.key, uploaded: false };
  }
  await store.putObject(named.key, bytes, contentType, metadata);
  return { success: true, key: named.key, uploaded: true };
}
