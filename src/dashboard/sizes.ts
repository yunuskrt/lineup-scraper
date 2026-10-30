// data-contract.md § 2, in its order
export const CONTENT_TABLES = [
  'competitions',
  'seasons',
  'clubs',
  'club_aliases',
  'players',
  'player_aliases',
  'matches',
  'match_teams',
  'lineups',
  'match_events',
  'memorability_scores',
] as const;
export type ContentTable = (typeof CONTENT_TABLES)[number];

// Neon plans page, checked 2026-10-30
export const NEON_FREE_LIMITS = {
  postgresBytes: 1_000_000_000,
  source: 'Neon Free plan: 1 GB of Postgres per project (checked 2026-10-30)',
} as const;

export interface TableSize {
  table: ContentTable;
  rows: number;
  bytes: number;
}

export interface PrefixSize {
  prefix: string;
  objects: number;
  bytes: number;
}

export interface SizesInput {
  target: string;
  tables: TableSize[] | null;
  databaseBytes: number | null;
  bucket: PrefixSize[] | null;
  notes: string[];
}

export interface SizesView extends SizesInput {
  readAt: string;
  // 0–1 of the Free plan's Postgres limit
  databaseShare: number | null;
  bucketBytes: number | null;
  limitSource: string;
}

export function sizesView(input: SizesInput, readAt: Date): SizesView {
  const { databaseBytes, bucket } = input;
  return {
    ...input,
    readAt: readAt.toISOString(),
    databaseShare:
      databaseBytes === null
        ? null
        : databaseBytes / NEON_FREE_LIMITS.postgresBytes,
    bucketBytes:
      bucket === null ? null : bucket.reduce((sum, p) => sum + p.bytes, 0),
    limitSource: NEON_FREE_LIMITS.source,
  };
}
