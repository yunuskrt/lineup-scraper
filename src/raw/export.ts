import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RAW_KINDS } from '@/raw/kinds.js';
import {
  renderSchema,
  SCHEMAS_RAW_DIR,
  schemaFileName,
} from '@/raw/schema-files.js';

mkdirSync(SCHEMAS_RAW_DIR, { recursive: true });
for (const [kind, schema] of Object.entries(RAW_KINDS)) {
  const file = path.join(SCHEMAS_RAW_DIR, schemaFileName(kind));
  writeFileSync(file, renderSchema(schema));
  console.log(`wrote schemas/raw/${schemaFileName(kind)}`);
}
