import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { filedImages, processImages } from '@/images/process.js';

let dir: string;

async function file(
  folder: string,
  name: string,
  width: number,
  height: number,
) {
  const target = path.join(dir, 'transfermarkt', folder, name);
  mkdirSync(path.dirname(target), { recursive: true });
  const image = await sharp({
    create: { width, height, channels: 3, background: '#336699' },
  })
    .png()
    .toBuffer();
  writeFileSync(target, image);
}

beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'images-'));
  await file('crest', '27.png', 100, 100);
  await file('crest', '36.png', 40, 40);
  await file('photo', '206.png', 139, 181);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('filedImages', () => {
  it('maps each id to its file whatever its extension', () => {
    expect(filedImages(dir, 'photo')).toEqual(
      new Map([['206', path.join('transfermarkt', 'photo', '206.png')]]),
    );
    expect(filedImages(path.join(dir, 'none'), 'crest')).toEqual(new Map());
  });
});

describe('processImages', () => {
  const clubs = [
    { slug: 'fenerbahce', transfermarktId: '36' },
    { slug: 'bayern-munich', transfermarktId: '27' },
    { slug: 'valencia', transfermarktId: '1049' },
  ];
  const players = [
    { slug: 'oliver-kahn', transfermarktId: '206' },
    { slug: 'no-id', transfermarktId: null },
  ];

  it('keys each image under its slug, sorted, with its id', async () => {
    const done = await processImages(clubs, players, dir, new Map());

    expect(done.keys.crests.map((e) => [e.slug, e.transfermarktId])).toEqual([
      ['bayern-munich', '27'],
      ['fenerbahce', '36'],
    ]);
    expect(done.keys.crests[0].key).toMatch(
      /^crests\/bayern-munich\/[0-9a-f]{12}\.webp$/,
    );
    expect(done.keys.photos[0].key).toMatch(
      /^players\/oliver-kahn\/[0-9a-f]{12}\.webp$/,
    );
    expect(done.missing).toEqual([
      { kind: 'crest', slug: 'valencia' },
      { kind: 'photo', slug: 'no-id' },
    ]);
    expect(done.small).toEqual([
      { kind: 'crest', slug: 'fenerbahce', width: 40, height: 40 },
    ]);
    // 139×181 is Transfermarkt's own framing
    expect(done.oddPhotos).toEqual([]);
    expect(done.made.find((m) => m.kind === 'photo')?.crop).toBe('centre');
  });

  it('applies a curated crop, and names crops for no one', async () => {
    const crops = new Map([
      ['oliver-kahn', 'bottom' as const],
      ['ghost', 'top' as const],
    ]);
    const plain = await processImages([], players, dir, new Map());
    const cropped = await processImages([], players, dir, crops);

    expect(cropped.made[0].crop).toBe('bottom');
    expect(cropped.unusedCrops).toEqual(['ghost']);
    // A plain square: same key either way
    expect(cropped.keys.photos[0].key).toBe(plain.keys.photos[0].key);
  });

  it('flags a photo that is not Transfermarkt framing', async () => {
    await file('photo', '411295.png', 200, 300);
    const done = await processImages(
      [],
      [{ slug: 'raphinha', transfermarktId: '411295' }, players[0]],
      dir,
      new Map(),
    );
    expect(done.oddPhotos).toEqual([
      { slug: 'raphinha', width: 200, height: 300 },
    ]);
  });

  it('gives the same keys on a rerun', async () => {
    const first = await processImages(clubs, players, dir, new Map());
    const second = await processImages(clubs, players, dir, new Map());
    expect(second.keys).toEqual(first.keys);
  });
});

describe('processImages, logos', () => {
  async function logo(name: string, colour: string) {
    const target = path.join(dir, 'logos', name);
    mkdirSync(path.dirname(target), { recursive: true });
    const image = await sharp({
      create: { width: 150, height: 150, channels: 3, background: colour },
    })
      .png()
      .toBuffer();
    writeFileSync(target, image);
  }
  const competitions = [
    { slug: 'premier-league', transfermarktCode: 'GB1' },
    { slug: 'euro', transfermarktCode: 'EURO' },
    { slug: 'world-cup', transfermarktCode: 'FIWC' },
  ];

  it('keys each filed logo on its slug, under competitions/', async () => {
    await logo('premier-league.png', '#f0f0f0');
    await logo('euro.webp', '#101830');
    const done = await processImages(
      [],
      [],
      dir,
      new Map(),
      competitions,
      new Map([['conference-league', 'white']]),
    );
    expect(done.keys.logos.map((e) => [e.slug, e.transfermarktCode])).toEqual([
      ['euro', 'EURO'],
      ['premier-league', 'GB1'],
    ]);
    expect(done.keys.logos[0]?.key).toMatch(
      /^competitions\/euro\/[0-9a-f]{12}\.webp$/,
    );
    expect(done.missing).toEqual([{ kind: 'logo', slug: 'world-cup' }]);
    expect(done.dark.map((d) => d.slug)).toEqual(['euro']);
    expect(done.unusedStyles).toEqual(['conference-league']);
    const made = done.made.find((m) => m.entry.slug === 'euro');
    expect(made?.source).toBe(path.join('logos', 'euro.webp'));
  });

  it('applies a curated white style and records it', async () => {
    await logo('euro.png', '#101830');
    const plain = await processImages([], [], dir, new Map(), competitions);
    const white = await processImages(
      [],
      [],
      dir,
      new Map(),
      competitions,
      new Map([['euro', 'white']]),
    );
    expect(white.keys.logos[0]?.key).not.toBe(plain.keys.logos[0]?.key);
    expect(white.made[0]?.style).toBe('white');
    expect(white.dark).toEqual([]);
  });
});
