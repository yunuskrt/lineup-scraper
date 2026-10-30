import { NEON_FREE_LIMITS, sizesView } from '@/dashboard/sizes.js';
import { memoryStore } from '@/storage/spec-store.js';

describe('sizesView', () => {
  const at = new Date('2026-10-30T12:00:00Z');

  it('measures the database against the Free plan and sums the bucket', () => {
    const view = sizesView(
      {
        target: 'ingest',
        tables: [{ table: 'lineups', rows: 66, bytes: 73_728 }],
        databaseBytes: 10_000_000,
        bucket: [
          { prefix: 'crests/', objects: 6, bytes: 40_000 },
          { prefix: 'players/', objects: 65, bytes: 210_000 },
        ],
        notes: [],
      },
      at,
    );
    expect(view.databaseShare).toBe(0.01);
    expect(view.bucketBytes).toBe(250_000);
    expect(view.readAt).toBe('2026-10-30T12:00:00.000Z');
    expect(view.limitSource).toBe(NEON_FREE_LIMITS.source);
  });

  it('keeps unread parts null', () => {
    const view = sizesView(
      {
        target: 'production',
        tables: null,
        databaseBytes: null,
        bucket: null,
        notes: ['x'],
      },
      at,
    );
    expect([view.databaseShare, view.bucketBytes]).toEqual([null, null]);
  });
});

describe('ObjectStore.measure', () => {
  it('counts objects and bytes under a prefix', async () => {
    const { store } = memoryStore();
    await store.putObject('crests/a/1.webp', new Uint8Array(10), 'image/webp');
    await store.putObject('crests/b/2.webp', new Uint8Array(5), 'image/webp');
    await store.putObject('players/c/3.webp', new Uint8Array(7), 'image/webp');
    expect(await store.measure('crests/')).toEqual({ objects: 2, bytes: 15 });
  });
});
