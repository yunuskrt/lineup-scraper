import type { ObjectStore } from '@/storage/client.js';
import { uploadImage } from '@/storage/upload.js';

const BYTES = new Uint8Array([1, 2, 3]);

function memoryStore() {
  const objects = new Map<string, string>();
  let puts = 0;
  const store: ObjectStore = {
    checkBucket: () => Promise.resolve(),
    hasObject: (key) => Promise.resolve(objects.has(key)),
    putObject: (key, _body, contentType) => {
      puts += 1;
      objects.set(key, contentType);
      return Promise.resolve();
    },
    countObjects: (prefix) =>
      Promise.resolve(
        [...objects.keys()].filter((k) => k.startsWith(prefix)).length,
      ),
  };
  return { store, objects, puts: () => puts };
}

describe('uploadImage', () => {
  it('uploads a new image under its key', async () => {
    const { store, objects } = memoryStore();
    const result = await uploadImage(store, {
      kind: 'crest',
      slug: 'valencia',
      bytes: BYTES,
      contentType: 'image/png',
    });
    expect(result).toMatchObject({ success: true, uploaded: true });
    expect(result.success && objects.get(result.key)).toBe('image/png');
  });

  it('uploads nothing on a rerun', async () => {
    const { store, puts } = memoryStore();
    const upload = {
      kind: 'player',
      slug: 'oliver-kahn',
      bytes: BYTES,
      contentType: 'image/webp',
    } as const;
    const first = await uploadImage(store, upload);
    const second = await uploadImage(store, upload);
    expect(second).toEqual({ ...first, uploaded: false });
    expect(puts()).toBe(1);
  });

  it('refuses before touching the store', async () => {
    const { store, puts } = memoryStore();
    const result = await uploadImage(store, {
      kind: 'player',
      slug: 'oliver-kahn',
      bytes: BYTES,
      contentType: 'image/jpeg',
    });
    expect(result.success).toBe(false);
    expect(puts()).toBe(0);
  });
});
