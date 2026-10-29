import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DATA_DIRS } from '@/config/data-dirs.js';
import type { StorageEnv } from '@/config/env.schema.js';
import { loadEnv, loadStorageEnv } from '@/config/load-env.js';
import { IMAGES_WORK, readImageKeys, type ImageKeys } from '@/images/keys.js';
import { uploadAll } from '@/images/upload.js';
import { datasetImageKeys, missingImages } from '@/load/images.js';
import { preflight } from '@/load/preflight.js';
import type { DatasetInput } from '@/dataset/schema.js';
import { createObjectStore, type ObjectStore } from '@/storage/client.js';
import { objectUrl } from '@/storage/keys.js';
import { checkStorageTarget } from '@/storage/target.js';

const SCHEMA = new URL('../../prisma/schema.prisma', import.meta.url);
const READ = { apply: false, target: null, confirm: false };

let env: StorageEnv;
let store: ObjectStore;
let keys: ImageKeys;
let pilot: DatasetInput;

describe('pilot images in a disposable branch', () => {
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
    const checked = preflight(DATA_DIRS.dataset, readFileSync(SCHEMA, 'utf8'));
    if (!checked.success) throw new Error(checked.error);
    pilot = checked.dataset;
    keys = readImageKeys();
    env = storageEnv.data;
    store = createObjectStore(env);
    await store.checkBucket();
  });

  it('starts with the dataset images missing from the bucket', async () => {
    const wanted = datasetImageKeys(pilot);
    expect(wanted).toHaveLength(71);
    expect(await missingImages(store, wanted)).toHaveLength(71);
  });

  it('uploads all 71, then nothing on a rerun', async () => {
    expect(await uploadAll(store, keys, IMAGES_WORK)).toEqual({
      success: true,
      counts: { uploaded: 71, present: 0 },
    });
    expect(await uploadAll(store, keys, IMAGES_WORK)).toEqual({
      success: true,
      counts: { uploaded: 0, present: 71 },
    });
  });

  it("holds every key the loader writes: the load's check passes", async () => {
    expect(await missingImages(store, datasetImageKeys(pilot))).toEqual([]);
  });

  it('leads each object back to its row', async () => {
    const kahn = pilot.players.find((p) => p.slug === 'oliver-kahn')!;
    expect(kahn.imageKey).toMatch(/^players\/oliver-kahn\//);
    expect(await store.readMetadata(kahn.imageKey!)).toEqual({
      slug: 'oliver-kahn',
      'transfermarkt-id': kahn.transfermarktId,
    });
  });

  it('serves a crest publicly as a WebP', async () => {
    const valencia = pilot.clubs.find((c) => c.slug === 'valencia')!;
    const response = await fetch(
      objectUrl(
        env.AWS_ENDPOINT_URL_S3,
        env.STORAGE_BUCKET,
        valencia.crestKey!,
      ),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    const local = readFileSync(path.join(IMAGES_WORK, valencia.crestKey!));
    expect(Buffer.from(await response.arrayBuffer()).equals(local)).toBe(true);
  });
});
