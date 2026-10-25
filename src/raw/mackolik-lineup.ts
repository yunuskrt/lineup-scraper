import { z } from 'zod';
import { digitsSchema, envelopeFields, rawTextSchema } from '@/raw/envelope.js';

// Mackolik's `d` keys, as sent
const scoreSchema = z.strictObject({
  s: z.string().nullable(),
  st: z.string().nullable(),
  ht: z.string().nullable(),
  ft: z.string().nullable(),
  et: z.string().nullable(),
  pt: z.string().nullable(),
});

const playerSchema = z.strictObject({
  sourceId: digitsSchema,
  name: rawTextSchema,
  // 0 when the source doesn't know it
  shirtNumber: z.number().int().min(0),
});

const eventSchema = z.strictObject({
  side: z.union([z.literal(1), z.literal(2)]),
  // Minute 0 occurs on some yellow cards
  minute: z.number().int().min(0),
  type: z.number().int().min(0),
  playerSourceId: digitsSchema.nullable(),
  playerName: z.string().nullable(),
  detail: z.string().nullable(),
  detailName: z.string().nullable(),
  assistSourceId: digitsSchema.nullable(),
  assistName: z.string().nullable(),
});

// MatchData.aspx; players in source order, all kept
export const mackolikLineupSchema = z.strictObject({
  ...envelopeFields('mackolik'),
  score: scoreSchema,
  home: z.array(playerSchema),
  away: z.array(playerSchema),
  events: z.array(eventSchema),
});

export type MackolikLineup = z.infer<typeof mackolikLineupSchema>;
