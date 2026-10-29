import { z } from 'zod';
import { envelopeFields, rawTextSchema, urlSchema } from '@/raw/envelope.js';

// A player profile page; every field as shown
export const transfermarktPlayerSchema = z.strictObject({
  ...envelopeFields('transfermarkt'),
  // The h1, shirt number included (`#11 Raphinha`)
  headline: rawTextSchema,
  // `DD/MM/YYYY (age)`
  dateOfBirth: rawTextSchema.nullable(),
  citizenship: rawTextSchema.nullable(),
  position: rawTextSchema.nullable(),
  // The info table's `Full name:`, as shown
  fullName: rawTextSchema.nullable(),
  nameInHomeCountry: rawTextSchema.nullable(),
  // The header's `Caps/Goals:` as shown (`43 / 12`)
  capsGoals: rawTextSchema.nullable(),
  // The header photo's src; null for a placeholder
  imageUrl: urlSchema.nullable(),
});

export type TransfermarktPlayer = z.infer<typeof transfermarktPlayerSchema>;
