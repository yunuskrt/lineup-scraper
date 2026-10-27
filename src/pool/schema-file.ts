import { fileURLToPath } from 'node:url';

export const POOL_SCHEMA_FILE = fileURLToPath(
  new URL('../../schemas/curation/pool.schema.json', import.meta.url),
);

export const POOL_MATCHES_SCHEMA_FILE = fileURLToPath(
  new URL('../../schemas/work/pool-matches.schema.json', import.meta.url),
);
