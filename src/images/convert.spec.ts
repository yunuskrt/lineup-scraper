import sharp from 'sharp';
import {
  contrastOnChip,
  convertCrest,
  convertLogo,
  convertPhoto,
} from '@/images/convert.js';
import { MIN_CONTRAST } from '@/images/process.js';

const RED = { r: 255, g: 0, b: 0 };
const BLUE = { r: 0, g: 0, b: 255 };

// A tall image: red on top, blue below
async function portrait(): Promise<Uint8Array> {
  const top = await sharp({
    create: { width: 100, height: 100, channels: 3, background: RED },
  })
    .png()
    .toBuffer();
  const image = await sharp({
    create: { width: 100, height: 150, channels: 3, background: BLUE },
  })
    .composite([{ input: top, left: 0, top: 0 }])
    .png()
    .toBuffer();
  return new Uint8Array(image);
}

async function pixel(bytes: Uint8Array, x: number, y: number) {
  const { data, info } = await sharp(bytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const at = (y * info.width + x) * 4;
  return { r: data[at], g: data[at + 1], b: data[at + 2], a: data[at + 3] };
}

describe('convertPhoto', () => {
  it('makes a 128×128 WebP from the top of a portrait', async () => {
    const out = await convertPhoto(await portrait(), 'top');
    const meta = await sharp(out.bytes).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', 128, 128]);
    expect([out.width, out.height]).toEqual([100, 150]);
    // The top crop is all red: no blue at all
    expect((await pixel(out.bytes, 64, 120)).r).toBeGreaterThan(200);
  });

  it('reaches the bottom with a bottom crop', async () => {
    const out = await convertPhoto(await portrait(), 'bottom');
    expect((await pixel(out.bytes, 64, 120)).b).toBeGreaterThan(200);
  });

  it('gives the same bytes twice', async () => {
    const source = await portrait();
    const [a, b] = await Promise.all([
      convertPhoto(source, 'top'),
      convertPhoto(source, 'top'),
    ]);
    expect(Buffer.from(a.bytes).equals(Buffer.from(b.bytes))).toBe(true);
  });
});

describe('convertCrest', () => {
  it('keeps a wide crest whole, letterboxed on transparency', async () => {
    const wide = await sharp({
      create: { width: 120, height: 60, channels: 4, background: RED },
    })
      .png()
      .toBuffer();
    const out = await convertCrest(new Uint8Array(wide));
    const meta = await sharp(out.bytes).metadata();
    expect([meta.width, meta.height, meta.hasAlpha]).toEqual([128, 128, true]);
    // Both ends of the crest are kept
    expect((await pixel(out.bytes, 1, 64)).r).toBeGreaterThan(200);
    expect((await pixel(out.bytes, 126, 64)).r).toBeGreaterThan(200);
    expect((await pixel(out.bytes, 64, 2)).a).toBe(0);
  });
});

// A wide logo: dark navy, transparent around
async function wideLogo(colour = '#101830'): Promise<Uint8Array> {
  const mark = await sharp({
    create: { width: 60, height: 40, channels: 3, background: colour },
  })
    .png()
    .toBuffer();
  const image = await sharp({
    create: {
      width: 200,
      height: 100,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: mark, left: 70, top: 30 }])
    .png()
    .toBuffer();
  return new Uint8Array(image);
}

describe('convertLogo', () => {
  it('fits the whole logo in a transparent 128×128 WebP', async () => {
    const out = await convertLogo(await wideLogo(), null);
    const meta = await sharp(out.bytes).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', 128, 128]);
    expect([out.width, out.height]).toEqual([200, 100]);
    expect((await pixel(out.bytes, 64, 64)).b).toBeGreaterThan(30);
    expect((await pixel(out.bytes, 64, 4)).a).toBe(0);
  });

  it('measures a dark logo as low contrast on the chip', async () => {
    const dark = await convertLogo(await wideLogo(), null);
    const light = await convertLogo(await wideLogo('#f0f0f0'), null);
    expect(dark.contrast).toBeLessThan(MIN_CONTRAST);
    expect(light.contrast).toBeGreaterThan(MIN_CONTRAST);
  });

  it('makes every visible pixel white, keeping the shape', async () => {
    const out = await convertLogo(await wideLogo(), 'white');
    const inside = await pixel(out.bytes, 64, 64);
    expect([inside.r, inside.g, inside.b]).toEqual([255, 255, 255]);
    expect((await pixel(out.bytes, 64, 4)).a).toBe(0);
    expect(out.contrast).toBeGreaterThan(15);
  });

  it('gives the same bytes on a rerun', async () => {
    const source = await wideLogo();
    const first = await convertLogo(source, 'white');
    const second = await convertLogo(source, 'white');
    expect(second.bytes).toEqual(first.bytes);
  });
});

describe('contrastOnChip', () => {
  it('ignores transparent pixels and is 1 with none visible', () => {
    const clear = new Uint8Array([255, 255, 255, 0]);
    expect(contrastOnChip(clear)).toBe(1);
    const white = new Uint8Array([255, 255, 255, 255, 0, 0, 0, 0]);
    expect(contrastOnChip(white)).toBeGreaterThan(19);
  });
});
