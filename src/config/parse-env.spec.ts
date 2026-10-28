import {
  formatEnvIssues,
  parseEnv,
  parseStorageEnv,
} from '@/config/parse-env.js';

const DATABASE_URL = 'postgresql://lineup:secret@db.example.com/neondb';
const base = { DATABASE_URL };

describe('parseEnv', () => {
  it('defaults LOAD_TARGET to ingest', () => {
    expect(parseEnv(base)).toEqual({
      success: true,
      data: { DATABASE_URL, LOAD_TARGET: 'ingest' },
    });
  });

  it.each(['ingest', 'disposable', 'production'])(
    'accepts LOAD_TARGET %s',
    (target) => {
      const result = parseEnv({ ...base, LOAD_TARGET: target });
      expect(result.success && result.data.LOAD_TARGET).toBe(target);
    },
  );

  it.each([
    ['dev', 'dev'],
    ['unknown', 'staging'],
    ['empty', ''],
  ])('rejects a %s LOAD_TARGET', (_, target) => {
    const result = parseEnv({ ...base, LOAD_TARGET: target });
    expect(!result.success && result.error.map((i) => i.key)).toEqual([
      'LOAD_TARGET',
    ]);
  });

  it('ignores keys outside the schema', () => {
    const result = parseEnv({ ...base, PATH: '/usr/bin' });
    if (!result.success) throw new Error('expected success');
    expect(result.data).not.toHaveProperty('PATH');
  });

  it('accepts both postgres URL schemes', () => {
    for (const url of [DATABASE_URL, 'postgres://u:p@localhost:5432/db']) {
      expect(parseEnv({ ...base, DATABASE_URL: url }).success).toBe(true);
    }
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['not a URL', 'neondb'],
    ['another scheme', 'mysql://u:p@localhost/db'],
  ])('rejects a %s DATABASE_URL', (_, url) => {
    const result = parseEnv({ ...base, DATABASE_URL: url });
    expect(!result.success && result.error.map((i) => i.key)).toEqual([
      'DATABASE_URL',
    ]);
  });

  it('reports every bad key at once', () => {
    const result = parseEnv({ LOAD_TARGET: 'dev' });
    expect(!result.success && result.error.map((i) => i.key)).toEqual([
      'DATABASE_URL',
      'LOAD_TARGET',
    ]);
  });

  it('never echoes a value in an issue', () => {
    const secret = 'mysql://lineup:hunter2@db.example.com/neondb';
    const result = parseEnv({ DATABASE_URL: secret, LOAD_TARGET: 'staging' });
    if (result.success) throw new Error('expected failure');
    const text = formatEnvIssues(result.error);
    expect(text).not.toContain('hunter2');
    expect(text).not.toContain('staging');
  });
});

describe('parseStorageEnv', () => {
  const storage = {
    AWS_ENDPOINT_URL_S3: 'https://br-x.storage.c-5.eu-central-1.aws.neon.tech',
    AWS_ACCESS_KEY_ID: 'nak_live_example',
    AWS_SECRET_ACCESS_KEY: 'nsk_live_hunter2',
    AWS_REGION: 'eu-central-1',
  };

  it('defaults STORAGE_BUCKET to images', () => {
    const result = parseStorageEnv(storage);
    expect(result.success && result.data.STORAGE_BUCKET).toBe('images');
  });

  it('names every missing key', () => {
    const result = parseStorageEnv({});
    expect(!result.success && result.error.map((i) => i.key)).toEqual([
      'AWS_ENDPOINT_URL_S3',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'AWS_REGION',
    ]);
  });

  it.each([
    ['http endpoint', { AWS_ENDPOINT_URL_S3: 'http://br-x.storage.example' }],
    ['bucket name', { STORAGE_BUCKET: 'Images_1' }],
  ])('rejects a bad %s', (_, change) => {
    expect(parseStorageEnv({ ...storage, ...change }).success).toBe(false);
  });

  it('never echoes the secret in an issue', () => {
    const result = parseStorageEnv({ ...storage, AWS_REGION: '' });
    if (result.success) throw new Error('expected failure');
    expect(formatEnvIssues(result.error)).not.toContain('hunter2');
  });
});

describe('formatEnvIssues', () => {
  it('lists one key per line under a header', () => {
    const text = formatEnvIssues([
      { key: 'DATABASE_URL', reason: 'Invalid URL' },
      { key: 'LOAD_TARGET', reason: 'Invalid option' },
    ]);
    expect(text).toBe(
      'Invalid environment:\n  DATABASE_URL: Invalid URL\n  LOAD_TARGET: Invalid option',
    );
  });
});
