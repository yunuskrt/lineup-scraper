import { z } from 'zod';
import { digitsSchema } from '@/raw/envelope.js';

const namesSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1)
      .transform((name) => name.normalize('NFC')),
  )
  .default([]);

// data/curation/aliases.json, by spieler id
export const aliasCurationSchema = z.record(
  digitsSchema,
  z.strictObject({ add: namesSchema, remove: namesSchema }),
);
export type AliasCuration = z.output<typeof aliasCurationSchema>;
