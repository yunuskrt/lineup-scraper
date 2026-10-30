import { eraLabel } from '@/dashboard/progress.js';
import type { CompetitionKind } from '@/dataset/enums.js';
import type { PoolMatch } from '@/pool/build.js';
import { startYear, type PoolConfig } from '@/pool/config.js';
import { seasonLabel } from '@/resolve/seasons.js';
import { ERA_BUCKETS, eraBucket } from '@/score/pool-rules.js';

// match-pool-scope.md § 3
export const FLOORS = {
  clubEra: 20,
  leagueSeason: 10,
  uclSeason: 7,
  tournament: 7,
} as const;

export type CellKind = keyof typeof FLOORS;

export interface CoverageCell {
  kind: CellKind;
  // A competition code or a curated club id
  owner: string;
  // A season label or an era label
  period: string;
  floor: number;
  pool: number;
  ingested: number;
  isBelow: boolean;
  // The pool itself is smaller than the floor
  isUnreachable: boolean;
}

const KIND_CELLS: Partial<Record<CompetitionKind, CellKind>> = {
  league: 'leagueSeason',
  ucl: 'uclSeason',
  world_cup: 'tournament',
  euro: 'tournament',
};

function cell(
  kind: CellKind,
  owner: string,
  period: string,
  pool: readonly PoolMatch[],
  isIngested: (id: string) => boolean,
): CoverageCell {
  const floor = FLOORS[kind];
  const ingested = pool.filter((m) => isIngested(m.sourceId)).length;
  return {
    kind,
    owner,
    period,
    floor,
    pool: pool.length,
    ingested,
    isBelow: ingested < floor,
    isUnreachable: pool.length < floor,
  };
}

function seasonIds(first: number, last: number, step: number): number[] {
  const ids: number[] = [];
  for (let id = first; id <= last; id += step) ids.push(id);
  return ids;
}

function competitionCells(
  config: PoolConfig,
  matches: readonly PoolMatch[],
  isIngested: (id: string) => boolean,
): CoverageCell[] {
  return config.competitions.flatMap(({ code, kind, seasons }) => {
    const cellKind = KIND_CELLS[kind];
    if (!cellKind) return [];
    const mine = matches.filter((m) => m.competitionCode === code);
    const labels = new Set(
      seasonIds(seasons.first, seasons.last, seasons.step).map((id) =>
        seasonLabel(kind, String(id)),
      ),
    );
    return [...labels].map((label) => {
      const pool = mine.filter(
        (m) => m.seasonId !== null && seasonLabel(kind, m.seasonId) === label,
      );
      return cell(cellKind, code, label, pool, isIngested);
    });
  });
}

function clubCells(
  config: PoolConfig,
  matches: readonly PoolMatch[],
  isIngested: (id: string) => boolean,
): CoverageCell[] {
  const kinds = new Map(config.competitions.map((c) => [c.code, c.kind]));
  const eraOf = (m: PoolMatch) => {
    const kind = kinds.get(m.competitionCode);
    if (kind === undefined || m.seasonId === null) return null;
    return eraBucket(startYear(kind, Number(m.seasonId)));
  };
  return config.clubs.flatMap(({ id }) => {
    if (id === null) return [];
    const mine = matches.filter((m) => m.home === id || m.away === id);
    return ERA_BUCKETS.map((_, era) =>
      cell(
        'clubEra',
        id,
        eraLabel(era),
        mine.filter((m) => eraOf(m) === era),
        isIngested,
      ),
    );
  });
}

// Playable means ingested
export function coverage(
  config: PoolConfig,
  matches: readonly PoolMatch[],
  ingested: ReadonlySet<string>,
): CoverageCell[] {
  const isIngested = (id: string) => ingested.has(id);
  return [
    ...clubCells(config, matches, isIngested),
    ...competitionCells(config, matches, isIngested),
  ];
}
