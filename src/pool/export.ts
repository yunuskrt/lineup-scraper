import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { poolConfigSchema } from '@/pool/config.js';
import { renderSchema } from '@/raw/schema-files.js';
import { POOL_SCHEMA_FILE } from '@/pool/schema-file.js';

mkdirSync(path.dirname(POOL_SCHEMA_FILE), { recursive: true });
writeFileSync(POOL_SCHEMA_FILE, renderSchema(poolConfigSchema));
console.log('wrote schemas/curation/pool.schema.json');
