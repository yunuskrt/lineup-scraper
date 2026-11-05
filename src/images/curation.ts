import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { DATA_DIRS } from '@/config/data-dirs.js';
import { cropSchema, type Crop } from '@/images/crop.js';

export const CURATION_FILE = path.join(DATA_DIRS.curation, 'images.json');

const slugSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

// One colour for the dark chip (S18c D2)
export const logoStyleSchema = z.enum(['white']);
export type LogoStyle = z.infer<typeof logoStyleSchema>;

// Photo crops and logo styles, by slug
export const imageCurationSchema = z.strictObject({
  photoCrops: z.record(slugSchema, cropSchema),
  logoStyles: z.record(slugSchema, logoStyleSchema).optional(),
});

export type ImageCuration = z.infer<typeof imageCurationSchema>;

function readCuration(file: string): ImageCuration | null {
  if (!existsSync(file)) return null;
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
  return parsed.data;
}

export function readImageCuration(file = CURATION_FILE): Map<string, Crop> {
  return new Map(Object.entries(readCuration(file)?.photoCrops ?? {}));
}

export function readLogoStyles(file = CURATION_FILE): Map<string, LogoStyle> {
  return new Map(Object.entries(readCuration(file)?.logoStyles ?? {}));
}
