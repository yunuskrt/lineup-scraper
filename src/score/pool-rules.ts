import type { CompetitionKind } from '@/dataset/enums.js';

// Ported from the backend's pool-rules.ts
// By season start year
export const ERA_BUCKETS = [
  { from: 2000, to: 2007 },
  { from: 2008, to: 2015 },
  { from: 2016, to: 2026 },
] as const;

export const TOURNAMENT_KINDS: readonly CompetitionKind[] = [
  'world_cup',
  'euro',
  'ucl',
];

// Provisional: retuned by B19 and B22
export const POOL_THRESHOLD = { league: 60, tournament: 45 } as const;

export function thresholdFor(kind: CompetitionKind): number {
  return TOURNAMENT_KINDS.includes(kind)
    ? POOL_THRESHOLD.tournament
    : POOL_THRESHOLD.league;
}

// The index of the bucket, or null outside them
export function eraBucket(seasonStart: number): number | null {
  const index = ERA_BUCKETS.findIndex(
    (bucket) => seasonStart >= bucket.from && seasonStart <= bucket.to,
  );
  return index === -1 ? null : index;
}
