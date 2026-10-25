import { z } from 'zod';

const unitSchema = z.number().min(0).max(1);
const strengthSchema = z.object({
  guessability: unitSchema,
  starPower: unitSchema,
});

// Read by the backend; a bad block turns neutral
export const sideSignalsBlockSchema = z.object({
  sides: z.object({ home: strengthSchema, away: strengthSchema }),
});
