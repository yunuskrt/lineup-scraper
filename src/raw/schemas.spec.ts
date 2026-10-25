import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { RAW_KINDS, type RawKind } from '@/raw/kinds.js';
import {
  EXAMPLES_DIR,
  renderSchema,
  SCHEMAS_RAW_DIR,
  schemaFileName,
} from '@/raw/schema-files.js';

const KINDS = Object.keys(RAW_KINDS) as RawKind[];

// § Rules for raw schemas; `format` is not enforced
const ALLOWED = new Set([
  '$schema',
  'type',
  'properties',
  'required',
  'additionalProperties',
  'items',
  'anyOf',
  'const',
  'enum',
  'pattern',
  'minimum',
  'maximum',
  'minLength',
  'minItems',
]);

// Keys under `properties` are field names, not keywords
function keywordsOf(node: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(node)) {
    for (const item of node) keywordsOf(item, found);
  } else if (node !== null && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      found.add(key);
      if (key === 'properties' && value !== null && typeof value === 'object') {
        for (const field of Object.values(value)) keywordsOf(field, found);
      } else {
        keywordsOf(value, found);
      }
    }
  }
  return found;
}

const examplesSchema = z.array(
  z.strictObject({ name: z.string().min(1), record: z.unknown() }),
);

function examples(kind: RawKind, verdict: 'valid' | 'invalid') {
  const file = path.join(EXAMPLES_DIR, `${kind}.${verdict}.json`);
  const parsed = examplesSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
  return parsed.map(({ name, record }) => [name, record] as const);
}

describe('schemas/raw', () => {
  it.each(KINDS)('%s is current (run `npm run schemas`)', (kind) => {
    const file = path.join(SCHEMAS_RAW_DIR, schemaFileName(kind));
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, 'utf8')).toBe(renderSchema(RAW_KINDS[kind]));
  });

  it('has a schema file for every kind and no other', () => {
    const files = readdirSync(SCHEMAS_RAW_DIR).filter((f) =>
      f.endsWith('.schema.json'),
    );
    expect(files.sort()).toEqual(KINDS.map(schemaFileName).sort());
  });

  it.each(KINDS)('%s uses only keywords both validators enforce', (kind) => {
    const json: unknown = JSON.parse(renderSchema(RAW_KINDS[kind]));
    expect([...keywordsOf(json)].filter((k) => !ALLOWED.has(k))).toEqual([]);
  });

  it.each(KINDS)('%s is Draft 2020-12 with a trailing newline', (kind) => {
    const text = renderSchema(RAW_KINDS[kind]);
    expect(text.endsWith('}\n')).toBe(true);
    expect(JSON.parse(text)).toHaveProperty(
      '$schema',
      'https://json-schema.org/draft/2020-12/schema',
    );
  });

  it('renders the same text twice', () => {
    for (const schema of Object.values(RAW_KINDS)) {
      expect(renderSchema(schema)).toBe(renderSchema(schema));
    }
  });
});

describe.each(KINDS)('%s examples', (kind) => {
  it.each(examples(kind, 'valid'))('accepts %s', (_, record) => {
    expect(RAW_KINDS[kind].safeParse(record).success).toBe(true);
  });

  it.each(examples(kind, 'invalid'))('rejects %s', (_, record) => {
    expect(RAW_KINDS[kind].safeParse(record).success).toBe(false);
  });
});
