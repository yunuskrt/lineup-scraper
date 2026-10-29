import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readImageCuration } from '@/images/curation.js';
import { keysBySlug, NO_IMAGE_KEYS, readImageKeys } from '@/images/keys.js';

let dir: string;

function write(name: string, text: string): string {
  const file = path.join(dir, name);
  writeFileSync(file, text);
  return file;
}

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'keys-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('readImageKeys', () => {
  it('reads nothing before `npm run images` runs', () => {
    expect(readImageKeys(path.join(dir, 'none.json'))).toBe(NO_IMAGE_KEYS);
  });

  it('maps slugs to keys', () => {
    const entry = { key: 'crests/a/1.webp', slug: 'a', transfermarktId: '1' };
    const file = write(
      'keys.json',
      JSON.stringify({ crests: [entry], photos: [] }),
    );
    expect(keysBySlug(readImageKeys(file).crests)).toEqual(
      new Map([['a', 'crests/a/1.webp']]),
    );
  });

  it('names the path of a bad entry, never its value', () => {
    const file = write(
      'keys.json',
      JSON.stringify({
        crests: [{ key: 'k', slug: 'a', transfermarktId: 'x9' }],
        photos: [],
      }),
    );
    expect(() => readImageKeys(file)).toThrow(
      'Invalid keys.json at crests.0.transfermarktId',
    );
    expect(() => readImageKeys(write('bad.json', '{'))).toThrow(
      'Invalid JSON in bad.json',
    );
  });
});

describe('readImageCuration', () => {
  it('reads photo crops by player slug', () => {
    const file = write(
      'images.json',
      JSON.stringify({ photoCrops: { 'oliver-kahn': 'centre', pirlo: 12 } }),
    );
    expect(readImageCuration(file)).toEqual(
      new Map<string, unknown>([
        ['oliver-kahn', 'centre'],
        ['pirlo', 12],
      ]),
    );
    expect(readImageCuration(path.join(dir, 'none.json'))).toEqual(new Map());
  });

  it('refuses an unknown crop, naming its path', () => {
    const file = write(
      'images.json',
      JSON.stringify({ photoCrops: { 'oliver-kahn': 'middle' } }),
    );
    expect(() => readImageCuration(file)).toThrow(
      'Invalid images.json at photoCrops.oliver-kahn',
    );
  });
});
