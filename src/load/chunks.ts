import type { Plan, Table, TablePlan } from '@/load/plan.js';
import type { ContentRows } from '@/load/rows.js';

export const PLAYER_CHUNK = 500;

type Tables = { [K in Table]: TablePlan<ContentRows[K][number]> };

// One transaction's share of the plan
export interface Chunk {
  name: string;
  tables: Partial<Tables>;
  retired: string[];
}

function pick<T>(plan: TablePlan<T>, keep: (row: T) => boolean): TablePlan<T> {
  return {
    create: plan.create.filter(keep),
    update: plan.update.filter(keep),
    delete: plan.delete.filter(keep),
    same: 0,
  };
}

function isEmpty(chunk: Chunk): boolean {
  const writes = Object.values(chunk.tables).some(
    (t) => t.create.length + t.update.length + t.delete.length > 0,
  );
  return !writes && chunk.retired.length === 0;
}

function playerSlugs(plan: Plan): string[] {
  return [
    ...new Set([
      ...[...plan.players.create, ...plan.players.update].map((p) => p.slug),
      ...[
        ...plan.playerAliases.create,
        ...plan.playerAliases.update,
        ...plan.playerAliases.delete,
      ].map((a) => a.player),
    ]),
  ].toSorted();
}

// D1: parents, players, seasons, retirements
export function planChunks(plan: Plan, wanted: ContentRows): Chunk[] {
  const chunks: Chunk[] = [
    {
      name: 'competitions, seasons and clubs',
      tables: {
        competitions: plan.competitions,
        seasons: plan.seasons,
        clubs: plan.clubs,
        clubAliases: plan.clubAliases,
      },
      retired: [],
    },
  ];
  const slugs = playerSlugs(plan);
  for (let start = 0; start < slugs.length; start += PLAYER_CHUNK) {
    const part = new Set(slugs.slice(start, start + PLAYER_CHUNK));
    chunks.push({
      name: `players ${start + 1}–${start + part.size}`,
      tables: {
        players: pick(plan.players, (p) => part.has(p.slug)),
        playerAliases: pick(plan.playerAliases, (a) => part.has(a.player)),
      },
      retired: [],
    });
  }
  const seasonOf = new Map(
    wanted.matches.map((m) => [m.slug, `${m.competition}/${m.season}`]),
  );
  const seasons = [...new Set(seasonOf.values())].toSorted();
  for (const season of seasons) {
    const inSeason = (row: { match?: string; slug?: string }) =>
      seasonOf.get(row.match ?? row.slug ?? '') === season;
    chunks.push({
      name: season,
      tables: {
        matches: pick(plan.matches, inSeason),
        matchTeams: pick(plan.matchTeams, inSeason),
        lineups: pick(plan.lineups, inSeason),
        matchEvents: pick(plan.matchEvents, inSeason),
        memorabilityScores: {
          ...pick(plan.memorabilityScores, inSeason),
          delete: [],
        },
      },
      retired: [],
    });
  }
  chunks.push({ name: 'retirements', tables: {}, retired: plan.retired });
  return chunks.filter((chunk) => !isEmpty(chunk));
}
