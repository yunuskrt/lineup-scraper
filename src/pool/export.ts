import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { poolMatchesSchema } from '@/pool/build.js';
import { poolConfigSchema } from '@/pool/config.js';
import { renderSchema } from '@/raw/schema-files.js';
import {
  POOL_MATCHES_SCHEMA_FILE,
  POOL_SCHEMA_FILE,
} from '@/pool/schema-file.js';

for (const [file, schema] of [
  [POOL_SCHEMA_FILE, poolConfigSchema],
  [POOL_MATCHES_SCHEMA_FILE, poolMatchesSchema],
] as const) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, renderSchema(schema));
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
}
