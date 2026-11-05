import sharp from 'sharp';
import type { LogoStyle } from '@/images/curation.js';
import { cropBox, SIZE, type Crop } from '@/images/crop.js';

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

export interface Converted {
  bytes: Uint8Array;
  // The source's size, for the report
  width: number;
  height: number;
}

async function sizeOf(source: Uint8Array) {
  const { width, height } = await sharp(source).metadata();
  if (!width || !height) throw new Error('Image has no size');
  return { width, height };
}

// Never cropped: the whole crest, letterboxed
export async function convertCrest(source: Uint8Array): Promise<Converted> {
  const size = await sizeOf(source);
  const bytes = await sharp(source)
    .resize(SIZE, SIZE, { fit: 'contain', background: TRANSPARENT })
    .webp({ quality: 90, alphaQuality: 100, effort: 6 })
    .toBuffer();
  return { bytes: new Uint8Array(bytes), ...size };
}

export async function convertPhoto(
  source: Uint8Array,
  crop: Crop,
): Promise<Converted> {
  const size = await sizeOf(source);
  const bytes = await sharp(source)
    .extract(cropBox(size.width, size.height, crop))
    .resize(SIZE, SIZE)
    .webp({ quality: 85, effort: 6 })
    .toBuffer();
  return { bytes: new Uint8Array(bytes), ...size };
}

// The filter chip at rest (display § 1)
const CHIP = { r: 0x0a, g: 0x0f, b: 0x0c };

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

// WCAG ratio of the visible mean, on the chip
export function contrastOnChip(rgba: Uint8Array): number {
  let weight = 0;
  let sum = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const alpha = rgba[i + 3]! / 255;
    weight += alpha;
    sum += alpha * luminance(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!);
  }
  if (weight === 0) return 1;
  const chip = luminance(CHIP.r, CHIP.g, CHIP.b);
  return (sum / weight + 0.05) / (chip + 0.05);
}

// Every visible pixel white, its shape kept
function whiten(rgba: Uint8Array): Uint8Array {
  const out = new Uint8Array(rgba);
  for (let i = 0; i < out.length; i += 4) out.fill(255, i, i + 3);
  return out;
}

export interface ConvertedLogo extends Converted {
  contrast: number;
}

// Never cropped, as crests; optionally one colour
export async function convertLogo(
  source: Uint8Array,
  style: LogoStyle | null,
): Promise<ConvertedLogo> {
  const size = await sizeOf(source);
  const fitted = await sharp(source)
    .resize(SIZE, SIZE, { fit: 'contain', background: TRANSPARENT })
    .ensureAlpha()
    .raw()
    .toBuffer();
  const pixels = style === 'white' ? whiten(fitted) : new Uint8Array(fitted);
  const bytes = await sharp(pixels, {
    raw: { width: SIZE, height: SIZE, channels: 4 },
  })
    .webp({ quality: 90, alphaQuality: 100, effort: 6 })
    .toBuffer();
  return {
    bytes: new Uint8Array(bytes),
    ...size,
    contrast: contrastOnChip(pixels),
  };
}
