import { z } from 'zod';
import { envelopeFields, rawTextSchema } from '@/raw/envelope.js';

// A player profile page; every field as shown
export const transfermarktPlayerSchema = z.strictObject({
  ...envelopeFields('transfermarkt'),
  // The h1, shirt number included (`#11 Raphinha`)
  headline: rawTextSchema,
  // `DD/MM/YYYY (age)`
  dateOfBirth: rawTextSchema.nullable(),
  citizenship: rawTextSchema.nullable(),
  position: rawTextSchema.nullable(),
});

export type TransfermarktPlayer = z.infer<typeof transfermarktPlayerSchema>;
