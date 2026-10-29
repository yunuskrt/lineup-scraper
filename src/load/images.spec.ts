import { datasetImageKeys, missingImages } from '@/load/images.js';
import type { DatasetInput } from '@/dataset/schema.js';
import { memoryStore } from '@/storage/spec-store.js';

const dataset = {
  competitions: [],
  clubs: [{ slug: 'valencia', crestKey: 'crests/valencia/1.webp' }],
  players: [
    { slug: 'oliver-kahn', imageKey: 'players/oliver-kahn/2.webp' },
    { slug: 'no-photo', imageKey: null },
  ],
  matches: [],
} as unknown as DatasetInput;

describe('datasetImageKeys', () => {
  it('lists every crest and photo key, sorted', () => {
    expect(datasetImageKeys(dataset)).toEqual([
      'crests/valencia/1.webp',
      'players/oliver-kahn/2.webp',
    ]);
  });
});

describe('missingImages', () => {
  it('names the keys with no object in the bucket', async () => {
    const { store } = memoryStore();
    await store.putObject('crests/valencia/1.webp', new Uint8Array(), 'x');
    await store.putObject('players/other/3.webp', new Uint8Array(), 'x');

    expect(await missingImages(store, datasetImageKeys(dataset))).toEqual([
      'players/oliver-kahn/2.webp',
    ]);
  });
});
