import { transfermarktFixtureSchema } from '@/raw/transfermarkt-fixture.js';
import { transfermarktMatchSchema } from '@/raw/transfermarkt-match.js';
import { transfermarktPlayerSchema } from '@/raw/transfermarkt-player.js';

// `<source>-<kind>`: one schema file per entry
export const RAW_KINDS = {
  'transfermarkt-fixture': transfermarktFixtureSchema,
  'transfermarkt-match': transfermarktMatchSchema,
  'transfermarkt-player': transfermarktPlayerSchema,
} as const;

export type RawKind = keyof typeof RAW_KINDS;
