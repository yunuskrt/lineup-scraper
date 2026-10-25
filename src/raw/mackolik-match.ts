import { z } from 'zod';
import { digitsSchema, envelopeFields, rawTextSchema } from '@/raw/envelope.js';

const teamSchema = z.strictObject({
  sourceId: digitsSchema,
  name: rawTextSchema,
});

// One row of a club season page or cup stage
export const mackolikMatchSchema = z.strictObject({
  ...envelopeFields('mackolik'),
  competition: rawTextSchema,
  season: rawTextSchema,
  stage: rawTextSchema.nullable(),
  // The displayed date, never startDate
  date: rawTextSchema,
  home: teamSchema,
  away: teamSchema,
  score: rawTextSchema.nullable(),
});

export type MackolikMatch = z.infer<typeof mackolikMatchSchema>;
