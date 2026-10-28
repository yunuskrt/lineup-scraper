import { createHash } from 'node:crypto';

export const IMAGE_KINDS = ['crest', 'player'] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];

export const IMAGE_PREFIXES: Record<ImageKind, string> = {
  crest: 'crests',
  player: 'players',
};

// The web's formats (display requirements § 1)
const EXTENSIONS = {
  'image/webp': 'webp',
  'image/png': 'png',
  'image/svg+xml': 'svg',
} as const;

export type ImageContentType = keyof typeof EXTENSIONS;

// A key's bytes never change
export const CACHE_CONTROL = 'public, max-age=31536000, immutable';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HASH_LENGTH = 12;

export type KeyResult =
  { success: true; key: string } | { success: false; error: string };

export function isImageContentType(value: string): value is ImageContentType {
  return Object.hasOwn(EXTENSIONS, value);
}

export function imageKey(
  kind: ImageKind,
  slug: string,
  bytes: Uint8Array,
  contentType: string,
): KeyResult {
  if (!SLUG.test(slug)) return { success: false, error: 'Invalid slug' };
  if (!isImageContentType(contentType)) {
    return { success: false, error: 'Unsupported content type' };
  }
  if (bytes.length === 0) return { success: false, error: 'Empty image' };
  const hash = createHash('sha256')
    .update(bytes)
    .digest('hex')
    .slice(0, HASH_LENGTH);
  const ext = EXTENSIONS[contentType];
  return {
    success: true,
    key: `${IMAGE_PREFIXES[kind]}/${slug}/${hash}.${ext}`,
  };
}

// Readable without a credential: public_read
export function objectUrl(endpoint: string, bucket: string, key: string) {
  return `${endpoint.replace(/\/+$/, '')}/${bucket}/${key}`;
}
