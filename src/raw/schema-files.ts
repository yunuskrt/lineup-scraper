import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

export const SCHEMAS_RAW_DIR = fileURLToPath(
  new URL('../../schemas/raw/', import.meta.url),
);

export const EXAMPLES_DIR = path.join(SCHEMAS_RAW_DIR, 'examples');

export function schemaFileName(kind: string): string {
  return `${kind}.schema.json`;
}

// Deterministic: a rerun is byte-identical
export function renderSchema(schema: z.ZodType): string {
  const json = z.toJSONSchema(schema, { target: 'draft-2020-12' });
  return `${JSON.stringify(json, null, 2)}\n`;
}
