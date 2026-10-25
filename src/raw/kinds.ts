import { mackolikLineupSchema } from '@/raw/mackolik-lineup.js';
import { mackolikMatchSchema } from '@/raw/mackolik-match.js';

// `<source>-<kind>`: one schema file per entry
export const RAW_KINDS = {
  'mackolik-match': mackolikMatchSchema,
  'mackolik-lineup': mackolikLineupSchema,
} as const;

export type RawKind = keyof typeof RAW_KINDS;
