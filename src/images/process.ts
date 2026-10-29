import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  convertCrest,
  convertPhoto,
  type Converted,
} from '@/images/convert.js';
import { DEFAULT_CROP, type Crop } from '@/images/crop.js';
import type { ImageEntry, ImageKeys } from '@/images/keys.js';
import { imageKey } from '@/storage/keys.js';

// Smallest sources that stay sharp (display § 1)
export const MIN_SIDE = { crest: 64, photo: 80 } as const;

// Transfermarkt's header photo; others may vary
export const STANDARD_PHOTO = { width: 139, height: 181 } as const;

export type ImageKind = keyof typeof MIN_SIDE;

export interface Row {
  slug: string;
  transfermarktId: string | null;
}

export interface Made {
  kind: ImageKind;
  entry: ImageEntry;
  bytes: Uint8Array;
  // Relative to the images folder
  source: string;
  width: number;
  height: number;
  crop: Crop | null;
}

export interface Processed {
  keys: ImageKeys;
  made: Made[];
  missing: { kind: ImageKind; slug: string }[];
  small: { kind: ImageKind; slug: string; width: number; height: number }[];
  // Photos the default crop wasn't checked on
  oddPhotos: { slug: string; width: number; height: number }[];
  // Crops for slugs not in the dataset
  unusedCrops: string[];
}

const FOLDER = { crest: 'crest', photo: 'photo' } as const;
const PREFIX_KIND = { crest: 'crest', photo: 'player' } as const;

// S18a's files by id, any extension; read once
export function filedImages(
  imagesDir: string,
  kind: ImageKind,
): Map<string, string> {
  const dir = path.join(imagesDir, 'transfermarkt', FOLDER[kind]);
  let names: string[];
  try {
    names = readdirSync(dir).toSorted();
  } catch {
    return new Map();
  }
  const found = new Map<string, string>();
  for (const name of names) {
    const id = path.parse(name).name;
    if (!found.has(id)) {
      found.set(id, path.join('transfermarkt', FOLDER[kind], name));
    }
  }
  return found;
}

async function convert(
  kind: ImageKind,
  source: Uint8Array,
  crop: Crop,
): Promise<Converted> {
  return kind === 'crest' ? convertCrest(source) : convertPhoto(source, crop);
}

async function processKind(
  kind: ImageKind,
  rows: Row[],
  imagesDir: string,
  crops: Map<string, Crop>,
  out: Processed,
): Promise<ImageEntry[]> {
  const entries: ImageEntry[] = [];
  const filed = filedImages(imagesDir, kind);
  for (const row of rows.toSorted((a, b) => (a.slug < b.slug ? -1 : 1))) {
    const source = row.transfermarktId
      ? (filed.get(row.transfermarktId) ?? null)
      : null;
    if (source === null || row.transfermarktId === null) {
      out.missing.push({ kind, slug: row.slug });
      continue;
    }
    const crop =
      kind === 'photo' ? (crops.get(row.slug) ?? DEFAULT_CROP) : null;
    const converted = await convert(
      kind,
      new Uint8Array(readFileSync(path.join(imagesDir, source))),
      crop ?? DEFAULT_CROP,
    );
    const named = imageKey(
      PREFIX_KIND[kind],
      row.slug,
      converted.bytes,
      'image/webp',
    );
    if (!named.success)
      throw new Error(`${named.error} for ${kind} ${row.slug}`);
    const entry = {
      key: named.key,
      slug: row.slug,
      transfermarktId: row.transfermarktId,
    };
    entries.push(entry);
    const { bytes, width, height } = converted;
    out.made.push({ kind, entry, bytes, source, width, height, crop });
    if (Math.min(width, height) < MIN_SIDE[kind]) {
      out.small.push({ kind, slug: row.slug, width, height });
    }
    const isStandard =
      width === STANDARD_PHOTO.width && height === STANDARD_PHOTO.height;
    if (kind === 'photo' && !isStandard) {
      out.oddPhotos.push({ slug: row.slug, width, height });
    }
  }
  return entries;
}

// One WebP per dataset club and player with a file
export async function processImages(
  clubs: Row[],
  players: Row[],
  imagesDir: string,
  crops: Map<string, Crop>,
): Promise<Processed> {
  const out: Processed = {
    keys: { crests: [], photos: [] },
    made: [],
    missing: [],
    small: [],
    oddPhotos: [],
    unusedCrops: [],
  };
  out.keys.crests = await processKind('crest', clubs, imagesDir, crops, out);
  out.keys.photos = await processKind('photo', players, imagesDir, crops, out);
  const slugs = new Set(players.map((p) => p.slug));
  out.unusedCrops = [...crops.keys()].filter((s) => !slugs.has(s)).toSorted();
  return out;
}
