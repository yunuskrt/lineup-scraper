import { z } from 'zod';

// Sources that have raw record kinds
export const SOURCES = ['transfermarkt'] as const;
export type Source = (typeof SOURCES)[number];

// Strings, so a leading zero or a huge id survives
export const digitsSchema = z.string().regex(/^[0-9]+$/);

// A pattern, not format: jsonschema skips formats
const urlSchema = z.string().regex(/^https?:\/\/\S+$/);

// ASCII digits: Python's \d matches any script
const utcDatetimeSchema = z
  .string()
  .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?Z$/);

// Source text as fetched, NFC applied by Python
export const rawTextSchema = z.string().min(1);

// Copied from a `datum/YYYY-MM-DD` link, never text
export const isoDateSchema = z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/);

// A linked entity: its numeric id and shown name
export const refSchema = z.strictObject({
  sourceId: digitsSchema,
  name: rawTextSchema,
});

export function envelopeFields<S extends Source>(source: S) {
  return {
    source: z.literal(source),
    sourceId: digitsSchema,
    sourceUrl: urlSchema,
    fetchedAt: utcDatetimeSchema,
  };
}
