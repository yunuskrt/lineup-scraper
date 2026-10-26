import { z } from 'zod';
import {
  digitsSchema,
  envelopeFields,
  isoDateSchema,
  rawTextSchema,
  refSchema,
} from '@/raw/envelope.js';

// One match row of a league, cup or tournament fixture list
export const transfermarktFixtureSchema = z.strictObject({
  ...envelopeFields('transfermarkt'),
  competitionCode: z.string().regex(/^[A-Z0-9]+$/),
  // null for World Cup and Euro: the code has the year
  seasonId: digitsSchema.nullable(),
  // The box headline: `1.Matchday`, `Group A`
  round: rawTextSchema.nullable(),
  // The knockout row's own cell: `QF`, `FI`, `Ro16 3`
  stage: rawTextSchema.nullable(),
  // Carried down from the day's first row
  date: isoDateSchema.nullable(),
  home: refSchema,
  away: refSchema,
  result: rawTextSchema.nullable(),
});

export type TransfermarktFixture = z.infer<typeof transfermarktFixtureSchema>;
