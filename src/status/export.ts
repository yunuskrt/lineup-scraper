import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { renderSchema } from '@/raw/schema-files.js';
import { remoteStatusSchema } from '@/status/remote.js';
import { REMOTE_STATUS_SCHEMA_FILE } from '@/status/schema-file.js';

mkdirSync(path.dirname(REMOTE_STATUS_SCHEMA_FILE), { recursive: true });
writeFileSync(REMOTE_STATUS_SCHEMA_FILE, renderSchema(remoteStatusSchema));
console.log(`wrote ${path.relative(process.cwd(), REMOTE_STATUS_SCHEMA_FILE)}`);
