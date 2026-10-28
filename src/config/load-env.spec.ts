const STORAGE_KEYS = [
  'AWS_ENDPOINT_URL_S3',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_REGION',
  'STORAGE_BUCKET',
] as const;
const KEYS = ['DATABASE_URL', 'LOAD_TARGET', ...STORAGE_KEYS] as const;
const DATABASE_URL = 'postgresql://u:p@db.example.com/neondb';

describe('loadEnv', () => {
  const original = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

  beforeEach(() => {
    vi.resetModules();
    process.env.DATABASE_URL = DATABASE_URL;
    delete process.env.LOAD_TARGET;
    for (const key of STORAGE_KEYS) delete process.env[key];
  });

  afterEach(() => {
    for (const key of KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  it('parses process.env once and reuses the result', async () => {
    process.env.LOAD_TARGET = 'disposable';
    const { loadEnv } = await import('@/config/load-env.js');
    const first = loadEnv();

    process.env.LOAD_TARGET = 'production';
    const second = loadEnv();

    expect(second).toBe(first);
    expect(first.success && first.data.LOAD_TARGET).toBe('disposable');
  });

  it('carries a failure without throwing', async () => {
    process.env.LOAD_TARGET = 'dev';
    const { loadEnv } = await import('@/config/load-env.js');
    const result = loadEnv();

    expect(result.success).toBe(false);
    expect(!result.success && result.error.map((i) => i.key)).toEqual([
      'LOAD_TARGET',
    ]);
  });

  it('needs no storage keys, so a load runs without them', async () => {
    const { loadEnv, loadStorageEnv } = await import('@/config/load-env.js');
    expect(loadEnv().success).toBe(true);
    expect(loadStorageEnv().success).toBe(false);
  });

  it('parses the storage keys once, apart from the rest', async () => {
    process.env.AWS_ENDPOINT_URL_S3 = 'https://br-x.storage.example';
    process.env.AWS_ACCESS_KEY_ID = 'nak_live_example';
    process.env.AWS_SECRET_ACCESS_KEY = 'nsk_live_example';
    process.env.AWS_REGION = 'eu-central-1';
    const { loadStorageEnv } = await import('@/config/load-env.js');
    const first = loadStorageEnv();

    process.env.STORAGE_BUCKET = 'other';
    expect(loadStorageEnv()).toBe(first);
    expect(first.success && first.data.STORAGE_BUCKET).toBe('images');
  });
});
