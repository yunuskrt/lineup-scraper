import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ImageKeys } from '@/images/keys.js';
import { uploadAll } from '@/images/upload.js';
import { imageKey } from '@/storage/keys.js';
import { memoryStore } from '@/storage/spec-store.js';

const BYTES = new Uint8Array([82, 73, 70, 70]);
let dir: string;
let keys: ImageKeys;

function put(key: string, bytes: Uint8Array) {
  mkdirSync(path.dirname(path.join(dir, key)), { recursive: true });
  writeFileSync(path.join(dir, key), bytes);
}

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'upload-'));
  const named = imageKey('player', 'oliver-kahn', BYTES, 'image/webp');
  if (!named.success) throw new Error(named.error);
  put(named.key, BYTES);
  keys = {
    crests: [],
    photos: [{ key: named.key, slug: 'oliver-kahn', transfermarktId: '206' }],
  };
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('uploadAll', () => {
  it('uploads with metadata that leads back to the row', async () => {
    const { store, objects } = memoryStore();

    expect(await uploadAll(store, keys, dir)).toEqual({
      success: true,
      counts: { uploaded: 1, present: 0 },
    });
    const stored = objects.get(keys.photos[0].key);
    expect(stored?.contentType).toBe('image/webp');
    expect(stored?.metadata).toEqual({
      slug: 'oliver-kahn',
      'transfermarkt-id': '206',
    });
  });

  it('uploads nothing on a rerun', async () => {
    const { store, puts } = memoryStore();
    await uploadAll(store, keys, dir);
    expect(await uploadAll(store, keys, dir)).toEqual({
      success: true,
      counts: { uploaded: 0, present: 1 },
    });
    expect(puts()).toBe(1);
  });

  it('refuses a file whose bytes no longer match its key', async () => {
    put(keys.photos[0].key, new Uint8Array([1, 2, 3]));
    const result = await uploadAll(memoryStore().store, keys, dir);
    expect(result.success).toBe(false);
    expect(!result.success && result.error).toContain('run npm run images');
  });
});
