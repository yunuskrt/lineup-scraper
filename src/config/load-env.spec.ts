const KEYS = ['DATABASE_URL', 'LOAD_TARGET'] as const;
const DATABASE_URL = 'postgresql://u:p@db.example.com/neondb';

describe('loadEnv', () => {
  const original = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

  beforeEach(() => {
    vi.resetModules();
    process.env.DATABASE_URL = DATABASE_URL;
    delete process.env.LOAD_TARGET;
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
});
