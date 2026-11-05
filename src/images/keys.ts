import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { DATA_DIRS } from '@/config/data-dirs.js';

export const IMAGES_WORK = path.join(DATA_DIRS.work, 'images');
export const KEYS_FILE = path.join(IMAGES_WORK, 'keys.json');

const entrySchema = z.strictObject({
  key: z.string().min(1),
  slug: z.string().min(1),
  transfermarktId: z.string().regex(/^[0-9]+$/),
});

// Competitions have no numeric id (S18c D4)
const logoEntrySchema = z.strictObject({
  key: z.string().min(1),
  slug: z.string().min(1),
  transfermarktCode: z.string().regex(/^[A-Z0-9]+$/),
});

// What `npm run images` made, for dataset and upload
export const imageKeysSchema = z.strictObject({
  crests: z.array(entrySchema),
  photos: z.array(entrySchema),
  logos: z.array(logoEntrySchema).default([]),
});

export type ImageEntry = z.infer<typeof entrySchema>;
export type LogoEntry = z.infer<typeof logoEntrySchema>;
export type ImageKeys = z.infer<typeof imageKeysSchema>;

export const NO_IMAGE_KEYS: ImageKeys = { crests: [], photos: [], logos: [] };

// Absent until `npm run images` runs
export function readImageKeys(file = KEYS_FILE): ImageKeys {
  if (!existsSync(file)) return NO_IMAGE_KEYS;
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw new Error(`Invalid JSON in ${path.basename(file)}`);
  }
  const parsed = imageKeysSchema.safeParse(value);
  if (!parsed.success) {
    const at = parsed.error.issues[0]?.path.join('.') ?? '';
    throw new Error(`Invalid ${path.basename(file)} at ${at || '(root)'}`);
  }
  return parsed.data;
}

export function keysBySlug(
  entries: { slug: string; key: string }[],
): Map<string, string> {
  return new Map(entries.map((e) => [e.slug, e.key]));
}
