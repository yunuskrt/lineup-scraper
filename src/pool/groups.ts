import { z } from 'zod';
import type { PoolConfig, poolGroupSchema } from '@/pool/config.js';
import type { TransfermarktFixture } from '@/raw/transfermarkt-fixture.js';

export type PoolGroup = z.infer<typeof poolGroupSchema>;

const DERBY_KINDS = new Set(['league', 'ucl', 'uel']);

// The config, indexed by Transfermarkt ids and codes
export interface PoolRules {
  competitions: Map<string, PoolConfig['competitions'][number]>;
  // Curated club id → its league code
  clubLeagues: Map<string, string>;
  derbyPairs: Set<string>;
  knockoutStages: PoolConfig['knockoutStages'];
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function poolRules(config: PoolConfig): PoolRules {
  const ids = new Map(config.clubs.map((club) => [club.key, club.id]));
  const derbyPairs = new Set<string>();
  for (const { clubs } of config.derbies) {
    const [a, b] = clubs.map((key) => ids.get(key));
    // A club with no id yet can't match any row
    if (a && b) derbyPairs.add(pairKey(a, b));
  }
  return {
    competitions: new Map(config.competitions.map((c) => [c.code, c])),
    clubLeagues: new Map(
      config.clubs.flatMap((club) => (club.id ? [[club.id, club.league]] : [])),
    ),
    derbyPairs,
    knockoutStages: config.knockoutStages,
  };
}

// `FI` keeps `FI` and `FI 3rd`; `QF` keeps `QF 2`
export function hasStage(
  stage: string | null,
  prefixes: readonly string[],
): boolean {
  return (
    stage !== null &&
    prefixes.some((p) => stage === p || stage.startsWith(`${p} `))
  );
}

export function groupsFor(
  row: TransfermarktFixture,
  rules: PoolRules,
): PoolGroup[] {
  const competition = rules.competitions.get(row.competitionCode);
  if (!competition) return [];
  const home = row.home.sourceId;
  const away = row.away.sourceId;
  const isDerby =
    DERBY_KINDS.has(competition.kind) &&
    rules.derbyPairs.has(pairKey(home, away));
  const isClash =
    competition.kind === 'league' &&
    rules.clubLeagues.get(home) === competition.code &&
    rules.clubLeagues.get(away) === competition.code;
  const found = competition.groups.filter((group) => {
    if (group === 'derbies') return isDerby;
    if (group === 'clashes') return isClash && !isDerby;
    const stages = rules.knockoutStages[group];
    return stages !== undefined && hasStage(row.stage, stages);
  });
  return found.toSorted();
}
