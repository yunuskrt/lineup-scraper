import { existsSync } from 'node:fs';
import type { StorageEnv } from '@/config/env.schema.js';
import { loadEnv, loadStorageEnv } from '@/config/load-env.js';
import { createObjectStore, type ObjectStore } from '@/storage/client.js';
import { CACHE_CONTROL, objectUrl } from '@/storage/keys.js';
import { checkStorageTarget } from '@/storage/target.js';
import { uploadImage } from '@/storage/upload.js';

const READ = { apply: false, target: null, confirm: false };
const SVG = 'image/svg+xml';

function svg(label: string) {
  return new TextEncoder().encode(
    `<svg xmlns="http://www.w3.org/2000/svg"><title>${label}</title></svg>`,
  );
}

let env: StorageEnv;
let store: ObjectStore;
// Unique per run: a rerun still uploads
const slug = `e2e-${Date.now().toString(36)}`;
const bytes = svg(slug);

describe('upload into a disposable branch', () => {
  beforeAll(async () => {
    if (existsSync('.env')) process.loadEnvFile('.env');
    const loaded = loadEnv();
    const storageEnv = loadStorageEnv();
    if (!loaded.success || !storageEnv.success) {
      throw new Error('Invalid environment');
    }
    // Never a shared branch (coding standards)
    if (loaded.data.LOAD_TARGET !== 'disposable') {
      throw new Error('test:e2e runs only with LOAD_TARGET=disposable');
    }
    const guard = checkStorageTarget(
      'disposable',
      storageEnv.data.AWS_ENDPOINT_URL_S3,
      READ,
    );
    if (!guard.success) throw new Error(guard.error);
    env = storageEnv.data;
    store = createObjectStore(env);
    await store.checkBucket();
  });

  it('uploads a new image under its content key', async () => {
    const result = await uploadImage(store, {
      kind: 'crest',
      slug,
      bytes,
      contentType: SVG,
    });
    expect(result).toMatchObject({ success: true, uploaded: true });
    expect(result.success && result.key).toMatch(
      new RegExp(`^crests/${slug}/[0-9a-f]{12}\\.svg$`),
    );
  });

  it('uploads nothing on a rerun', async () => {
    const result = await uploadImage(store, {
      kind: 'crest',
      slug,
      bytes,
      contentType: SVG,
    });
    expect(result).toMatchObject({ success: true, uploaded: false });
  });

  it('gives another slug and changed bytes their own keys', async () => {
    const other = await uploadImage(store, {
      kind: 'player',
      slug,
      bytes,
      contentType: SVG,
    });
    const changed = await uploadImage(store, {
      kind: 'crest',
      slug,
      bytes: svg(`${slug}-2`),
      contentType: SVG,
    });
    expect(other).toMatchObject({ success: true, uploaded: true });
    expect(changed).toMatchObject({ success: true, uploaded: true });
    expect(await store.countObjects(`crests/${slug}/`)).toBe(2);
    expect(await store.countObjects(`players/${slug}/`)).toBe(1);
  });

  it('serves the bytes publicly, with type and cache headers', async () => {
    const named = await uploadImage(store, {
      kind: 'crest',
      slug,
      bytes,
      contentType: SVG,
    });
    if (!named.success) throw new Error(named.error);
    // Our own bucket, read without a credential
    const response = await fetch(
      objectUrl(env.AWS_ENDPOINT_URL_S3, env.STORAGE_BUCKET, named.key),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(SVG);
    expect(response.headers.get('cache-control')).toBe(CACHE_CONTROL);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  });
});
