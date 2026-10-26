import { z } from 'zod';
import {
  digitsSchema,
  envelopeFields,
  isoDateSchema,
  rawTextSchema,
  refSchema,
} from '@/raw/envelope.js';

const starterSchema = z.strictObject({
  sourceId: digitsSchema,
  name: rawTextSchema,
  shirtNumber: rawTextSchema.nullable(),
  // `top: 80%; left: 40%;` as sent; S11 maps it to a slot
  style: rawTextSchema,
  isCaptain: z.boolean(),
});

const benchSchema = z.strictObject({
  sourceId: digitsSchema,
  name: rawTextSchema,
  shirtNumber: rawTextSchema.nullable(),
  position: rawTextSchema.nullable(),
});

const sideSchema = z.strictObject({
  sourceId: digitsSchema,
  name: rawTextSchema,
  tablePosition: rawTextSchema.nullable(),
  formation: rawTextSchema.nullable(),
  starters: z.array(starterSchema),
  bench: z.array(benchSchema),
});

const eventSchema = z.strictObject({
  box: z.enum(['goal', 'card', 'substitution']),
  side: z.enum(['home', 'away']),
  // The clock sprite's style; S11 decodes the minute
  clock: rawTextSchema.nullable(),
  addedTime: rawTextSchema.nullable(),
  players: z.array(refSchema),
  text: rawTextSchema,
});

// One match report; `result` is the shootout on pens
export const transfermarktMatchSchema = z.strictObject({
  ...envelopeFields('transfermarkt'),
  round: rawTextSchema,
  date: isoDateSchema,
  result: rawTextSchema,
  resultNote: rawTextSchema.nullable(),
  home: sideSchema,
  away: sideSchema,
  events: z.array(eventSchema),
});

export type TransfermarktMatch = z.infer<typeof transfermarktMatchSchema>;
