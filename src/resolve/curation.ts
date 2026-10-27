import { z } from 'zod';
import { digitsSchema } from '@/raw/envelope.js';

function isRegExp(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

const slugSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

// data/curation/crosswalk/*.json: source key → slug
export const crosswalkSchema = z.record(z.string().min(1), slugSchema);
export type Crosswalk = z.infer<typeof crosswalkSchema>;

// data/curation/club-names.json, keyed by verein id
export const clubNamesSchema = z.record(
  digitsSchema,
  z.strictObject({
    name: z.string().trim().min(1).optional(),
    shortName: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
  }),
);
export type ClubNames = z.infer<typeof clubNamesSchema>;

// data/curation/stage-names.json
export const stageNamesSchema = z.strictObject({
  // Knockout code without its tie number → text
  stages: z.record(z.string().min(1), z.string().trim().min(1)),
  // Round text patterns; `$1` is the first group
  rounds: z.array(
    z.strictObject({
      pattern: z.string().min(1).refine(isRegExp, 'Not a valid pattern'),
      text: z.string().trim().min(1),
    }),
  ),
});
export type StageNames = z.infer<typeof stageNamesSchema>;
