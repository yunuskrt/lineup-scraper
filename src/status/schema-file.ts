import { fileURLToPath } from 'node:url';

export const REMOTE_STATUS_SCHEMA_FILE = fileURLToPath(
  new URL('../../schemas/work/status-remote.schema.json', import.meta.url),
);
