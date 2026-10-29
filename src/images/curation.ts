import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { DATA_DIRS } from '@/config/data-dirs.js';
import { cropSchema, type Crop } from '@/images/crop.js';

export const CURATION_FILE = path.join(DATA_DIRS.curation, 'images.json');

// Per-photo crops, by player slug
export const imageCurationSchema = z.strictObject({
  photoCrops: z.record(
    z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    cropSchema,
  ),
});

export type ImageCuration = z.infer<typeof imageCurationSchema>;

export function readImageCuration(file = CURATION_FILE): Map<string, Crop> {
  if (!existsSync(file)) return new Map();
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw new Error(`Invalid JSON in ${path.basename(file)}`);
  }
  const parsed = imageCurationSchema.safeParse(value);
  if (!parsed.success) {
    const at = parsed.error.issues[0]?.path.join('.') ?? '';
    throw new Error(`Invalid ${path.basename(file)} at ${at || '(root)'}`);
  }
  return new Map(Object.entries(parsed.data.photoCrops));
}
