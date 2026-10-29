import sharp from 'sharp';
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
