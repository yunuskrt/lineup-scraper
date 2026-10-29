import { memoryStore } from '@/storage/spec-store.js';
import { uploadImage } from '@/storage/upload.js';

const BYTES = new Uint8Array([1, 2, 3]);

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
    expect(result.success && objects.get(result.key)?.contentType).toBe(
      'image/png',
    );
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

  it('stores the metadata that leads back to the row', async () => {
    const { store } = memoryStore();
    const result = await uploadImage(store, {
      kind: 'player',
      slug: 'oliver-kahn',
      bytes: BYTES,
      contentType: 'image/webp',
      metadata: { slug: 'oliver-kahn', 'transfermarkt-id': '206' },
    });
    if (!result.success) throw new Error(result.error);
    expect(await store.readMetadata(result.key)).toEqual({
      slug: 'oliver-kahn',
      'transfermarkt-id': '206',
    });
    expect(await store.readMetadata('players/x/0.webp')).toBeNull();
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
