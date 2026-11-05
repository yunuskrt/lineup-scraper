import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  convertCrest,
  convertLogo,
  convertPhoto,
  type Converted,
} from '@/images/convert.js';
import { DEFAULT_CROP, type Crop } from '@/images/crop.js';
import type { LogoStyle } from '@/images/curation.js';
import type { ImageEntry, ImageKeys, LogoEntry } from '@/images/keys.js';
import { imageKey } from '@/storage/keys.js';

// Smallest sources that stay sharp (display § 1)
export const MIN_SIDE = { crest: 64, photo: 80, logo: 40 } as const;

// WCAG's 3:1 for graphics; check below it
export const MIN_CONTRAST = 3;

// Transfermarkt's header photo; others may vary
export const STANDARD_PHOTO = { width: 139, height: 181 } as const;

export type ImageKind = keyof typeof MIN_SIDE;

export interface Row {
  slug: string;
  transfermarktId: string | null;
}

export interface LogoRow {
  slug: string;
  transfermarktCode: string;
}

export interface Made {
  kind: ImageKind;
  entry: { key: string; slug: string };
  bytes: Uint8Array;
  // Relative to the images folder
  source: string;
  width: number;
  height: number;
  crop: Crop | null;
  // Logos only
  contrast: number | null;
  style: LogoStyle | null;
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
  // Logos below MIN_CONTRAST on the chip
  dark: { slug: string; contrast: number }[];
  // Styles for slugs not in the dataset
  unusedStyles: string[];
}

// Logos by slug, from any source (S18c D1)
const FOLDER = {
  crest: path.join('transfermarkt', 'crest'),
  photo: path.join('transfermarkt', 'photo'),
  logo: 'logos',
} as const;
const PREFIX_KIND = { crest: 'crest', photo: 'player' } as const;

// Filed by id (or slug), any extension; read once
export function filedImages(
  imagesDir: string,
  kind: ImageKind,
): Map<string, string> {
  let names: string[];
  try {
    names = readdirSync(path.join(imagesDir, FOLDER[kind])).toSorted();
  } catch {
    return new Map();
  }
  const found = new Map<string, string>();
  for (const name of names) {
    const id = path.parse(name).name;
    if (!found.has(id)) found.set(id, path.join(FOLDER[kind], name));
  }
  return found;
}

async function convert(
  kind: 'crest' | 'photo',
  source: Uint8Array,
  crop: Crop,
): Promise<Converted> {
  return kind === 'crest' ? convertCrest(source) : convertPhoto(source, crop);
}

async function processKind(
  kind: 'crest' | 'photo',
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
    out.made.push({
      kind,
      entry,
      bytes,
      source,
      width,
      height,
      crop,
      contrast: null,
      style: null,
    });
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

// Keyed on the competition slug (S18c D4)
async function processLogos(
  competitions: LogoRow[],
  imagesDir: string,
  styles: Map<string, LogoStyle>,
  out: Processed,
): Promise<LogoEntry[]> {
  const entries: LogoEntry[] = [];
  const filed = filedImages(imagesDir, 'logo');
  for (const row of competitions.toSorted((a, b) =>
    a.slug < b.slug ? -1 : 1,
  )) {
    const source = filed.get(row.slug);
    if (source === undefined) {
      out.missing.push({ kind: 'logo', slug: row.slug });
      continue;
    }
    const style = styles.get(row.slug) ?? null;
    const converted = await convertLogo(
      new Uint8Array(readFileSync(path.join(imagesDir, source))),
      style,
    );
    const named = imageKey(
      'competition',
      row.slug,
      converted.bytes,
      'image/webp',
    );
    if (!named.success) throw new Error(`${named.error} for logo ${row.slug}`);
    const entry = {
      key: named.key,
      slug: row.slug,
      transfermarktCode: row.transfermarktCode,
    };
    entries.push(entry);
    const { bytes, width, height, contrast } = converted;
    out.made.push({
      kind: 'logo',
      entry,
      bytes,
      source,
      width,
      height,
      crop: null,
      contrast,
      style,
    });
    if (Math.min(width, height) < MIN_SIDE.logo) {
      out.small.push({ kind: 'logo', slug: row.slug, width, height });
    }
    if (contrast < MIN_CONTRAST) out.dark.push({ slug: row.slug, contrast });
  }
  return entries;
}

function unused<T>(curated: Map<string, T>, rows: { slug: string }[]) {
  const slugs = new Set(rows.map((r) => r.slug));
  return [...curated.keys()].filter((s) => !slugs.has(s)).toSorted();
}

// One WebP per dataset row with a file
export async function processImages(
  clubs: Row[],
  players: Row[],
  imagesDir: string,
  crops: Map<string, Crop>,
  competitions: LogoRow[] = [],
  styles: Map<string, LogoStyle> = new Map(),
): Promise<Processed> {
  const out: Processed = {
    keys: { crests: [], photos: [], logos: [] },
    made: [],
    missing: [],
    small: [],
    oddPhotos: [],
    unusedCrops: [],
    dark: [],
    unusedStyles: [],
  };
  out.keys.crests = await processKind('crest', clubs, imagesDir, crops, out);
  out.keys.photos = await processKind('photo', players, imagesDir, crops, out);
  out.keys.logos = await processLogos(competitions, imagesDir, styles, out);
  out.unusedCrops = unused(crops, players);
  out.unusedStyles = unused(styles, competitions);
  return out;
}
