import type { Processed } from '@/images/process.js';
import { renderReport, renderSheet } from '@/images/report.js';

const processed: Processed = {
  keys: {
    crests: [{ key: 'crests/a/1.webp', slug: 'a', transfermarktId: '1' }],
    photos: [{ key: 'players/b/2.webp', slug: 'b', transfermarktId: '2' }],
  },
  made: [
    {
      kind: 'crest',
      entry: { key: 'crests/a/1.webp', slug: 'a', transfermarktId: '1' },
      bytes: new Uint8Array(),
      source: 'transfermarkt/crest/1.png',
      width: 100,
      height: 100,
      crop: null,
    },
    {
      kind: 'photo',
      entry: { key: 'players/b/2.webp', slug: 'b', transfermarktId: '2' },
      bytes: new Uint8Array(),
      source: 'transfermarkt/photo/2.jpg',
      width: 139,
      height: 181,
      crop: 'bottom',
    },
  ],
  missing: [{ kind: 'photo', slug: 'c' }],
  small: [{ kind: 'crest', slug: 'a', width: 40, height: 40 }],
  oddPhotos: [{ slug: 'b', width: 200, height: 300 }],
  unusedCrops: ['ghost'],
};

describe('renderReport', () => {
  it('counts and lists what needs a look', () => {
    const text = renderReport(processed);
    expect(text).toContain('Crests: 1. Photos: 1. Missing: 1.');
    expect(text).toContain('- photo `c`');
    expect(text).toContain('- crest `a`: 40×40');
    expect(text).toContain('- `b`: bottom');
    expect(text).toContain('Photos to check by eye: 1');
    expect(text).toContain('- `b`: 200×300');
    expect(text).toContain('- `ghost`');
  });
});

describe('renderSheet', () => {
  it('shows each output beside its source, as the app does', () => {
    const html = renderSheet(processed);
    expect(html).toContain('<figure class="photo">');
    expect(html).toContain('src="../work/images/players/b/2.webp"');
    expect(html).toContain('src="../images/transfermarkt/photo/2.jpg"');
    expect(html).toContain('border-radius: 50%');
    expect(html).toContain('<h1>Photos (1)</h1>');
  });
});
