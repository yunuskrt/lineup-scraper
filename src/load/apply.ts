import type { Prisma, PrismaClient } from '@/generated/prisma/client.js';
import type { Chunk } from '@/load/chunks.js';
import { TABLES, type Table, type TablePlan } from '@/load/plan.js';
import type {
  EventRow,
  LineupRow,
  MatchRow,
  MatchTeamRow,
  ScoreRow,
  SeasonRow,
} from '@/load/rows.js';

type Tx = Prisma.TransactionClient;

// As the backend seed: Neon round-trips add up
const TRANSACTION = { maxWait: 10_000, timeout: 120_000 };

export interface Written {
  created: number;
  updated: number;
  deleted: number;
}
export type ApplyReport = Record<Table, Written>;

function emptyReport(): ApplyReport {
  return Object.fromEntries(
    TABLES.map((table) => [table, { created: 0, updated: 0, deleted: 0 }]),
  ) as ApplyReport;
}

function none<T>(): TablePlan<T> {
  return { create: [], update: [], delete: [], same: 0 };
}

function idOf(ids: Map<string, string>, key: string): string {
  const id = ids.get(key);
  // A slug, never a name: safe to print
  if (!id) throw new Error(`Load lost track of ${key}`);
  return id;
}

async function competitionIds(tx: Tx, slugs: string[]) {
  const rows = await tx.competition.findMany({
    where: { slug: { in: slugs } },
  });
  return new Map(rows.map((r) => [r.slug, r.id]));
}

async function clubIds(tx: Tx, slugs: string[]) {
  const rows = await tx.club.findMany({ where: { slug: { in: slugs } } });
  return new Map(rows.map((r) => [r.slug, r.id]));
}

async function playerIds(tx: Tx, slugs: string[]) {
  const rows = await tx.player.findMany({ where: { slug: { in: slugs } } });
  return new Map(rows.map((r) => [r.slug, r.id]));
}

// `competition|label` → season id
async function seasonIds(tx: Tx, rows: { competition: string }[]) {
  const comps = await competitionIds(tx, [
    ...new Set(rows.map((r) => r.competition)),
  ]);
  const seasons = await tx.season.findMany({
    where: { competitionId: { in: [...comps.values()] } },
    include: { competition: true },
  });
  return new Map(
    seasons.map((s) => [`${s.competition.slug}|${s.label}`, s.id]),
  );
}

async function writeParents(tx: Tx, chunk: Chunk, report: ApplyReport) {
  const t = chunk.tables;
  const competitions = t.competitions ?? none();
  report.competitions.created += (
    await tx.competition.createMany({ data: competitions.create })
  ).count;
  for (const row of competitions.update) {
    await tx.competition.update({ where: { slug: row.slug }, data: row });
    report.competitions.updated += 1;
  }

  const seasons = t.seasons ?? none<SeasonRow>();
  const comps = await competitionIds(tx, [
    ...new Set(
      [...seasons.create, ...seasons.update].map((s) => s.competition),
    ),
  ]);
  const seasonData = (s: SeasonRow) => ({
    competitionId: idOf(comps, s.competition),
    label: s.label,
    startYear: s.startYear,
  });
  report.seasons.created += (
    await tx.season.createMany({ data: seasons.create.map(seasonData) })
  ).count;
  for (const row of seasons.update) {
    const data = seasonData(row);
    await tx.season.update({
      where: {
        competitionId_label: {
          competitionId: data.competitionId,
          label: row.label,
        },
      },
      data,
    });
    report.seasons.updated += 1;
  }

  const clubs = t.clubs ?? none();
  report.clubs.created += (
    await tx.club.createMany({ data: clubs.create })
  ).count;
  for (const row of clubs.update) {
    await tx.club.update({ where: { slug: row.slug }, data: row });
    report.clubs.updated += 1;
  }

  const aliases = t.clubAliases ?? none();
  const aliasClubs = await clubIds(tx, [
    ...new Set([...aliases.create, ...aliases.delete].map((a) => a.club)),
  ]);
  report.clubAliases.created += (
    await tx.clubAlias.createMany({
      data: aliases.create.map((a) => ({
        clubId: idOf(aliasClubs, a.club),
        alias: a.alias,
      })),
    })
  ).count;
  for (const row of aliases.delete) {
    await tx.clubAlias.delete({
      where: {
        clubId_alias: { clubId: idOf(aliasClubs, row.club), alias: row.alias },
      },
    });
    report.clubAliases.deleted += 1;
  }
}

async function writePlayers(tx: Tx, chunk: Chunk, report: ApplyReport) {
  const players = chunk.tables.players ?? none();
  report.players.created += (
    await tx.player.createMany({ data: players.create })
  ).count;
  for (const row of players.update) {
    await tx.player.update({ where: { slug: row.slug }, data: row });
    report.players.updated += 1;
  }
  const aliases = chunk.tables.playerAliases ?? none();
  const ids = await playerIds(tx, [
    ...new Set(
      [...aliases.create, ...aliases.update, ...aliases.delete].map(
        (a) => a.player,
      ),
    ),
  ]);
  report.playerAliases.created += (
    await tx.playerAlias.createMany({
      data: aliases.create.map((a) => ({
        playerId: idOf(ids, a.player),
        alias: a.alias,
        normalized: a.normalized,
      })),
    })
  ).count;
  const where = (row: { player: string; normalized: string }) => ({
    playerId_normalized: {
      playerId: idOf(ids, row.player),
      normalized: row.normalized,
    },
  });
  for (const row of aliases.update) {
    await tx.playerAlias.update({
      where: where(row),
      data: { alias: row.alias },
    });
    report.playerAliases.updated += 1;
  }
  for (const row of aliases.delete) {
    await tx.playerAlias.delete({ where: where(row) });
    report.playerAliases.deleted += 1;
  }
}

function matchData(row: MatchRow, seasons: Map<string, string>) {
  return {
    slug: row.slug,
    seasonId: idOf(seasons, `${row.competition}|${row.season}`),
    date: new Date(`${row.date}T00:00:00Z`),
    stage: row.stage,
    nickname: row.nickname,
    extraTime: row.extraTime,
    shootoutHome: row.shootoutHome,
    shootoutAway: row.shootoutAway,
    transfermarktId: row.transfermarktId,
  };
}

async function matchIds(tx: Tx, slugs: string[]) {
  const rows = await tx.match.findMany({
    where: { slug: { in: slugs } },
    include: { teams: true },
  });
  return {
    matches: new Map(rows.map((m) => [m.slug, m.id])),
    teams: new Map(
      rows.flatMap((m) =>
        m.teams.map((t) => [`${m.slug}|${t.side}`, t.id] as const),
      ),
    ),
  };
}

function groupBy<T>(rows: T[], keyOf: (row: T) => string) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    groups.set(keyOf(row), [...(groups.get(keyOf(row)) ?? []), row]);
  }
  return groups;
}

async function writeMatches(tx: Tx, chunk: Chunk, report: ApplyReport) {
  const t = chunk.tables;
  const matches = t.matches ?? none<MatchRow>();
  const seasons = await seasonIds(tx, [...matches.create, ...matches.update]);
  report.matches.created += (
    await tx.match.createMany({
      data: matches.create.map((m) => matchData(m, seasons)),
    })
  ).count;
  for (const row of matches.update) {
    await tx.match.update({
      where: { slug: row.slug },
      data: matchData(row, seasons),
    });
    report.matches.updated += 1;
  }

  const teams = t.matchTeams ?? none<MatchTeamRow>();
  const lineups = t.lineups ?? none<LineupRow>();
  const events = t.matchEvents ?? none<EventRow>();
  const scores = t.memorabilityScores ?? none<ScoreRow>();
  const slugs = [
    ...new Set(
      [
        ...teams.create,
        ...teams.update,
        ...lineups.create,
        ...lineups.delete,
        ...events.create,
        ...events.delete,
        ...scores.create,
        ...scores.update,
      ].map((r) => r.match),
    ),
  ];
  const ids = await matchIds(tx, slugs);
  const clubs = await clubIds(tx, [
    ...new Set([...teams.create, ...teams.update].map((r) => r.club)),
  ]);
  const teamData = (r: MatchTeamRow) => ({
    matchId: idOf(ids.matches, r.match),
    side: r.side,
    clubId: idOf(clubs, r.club),
    goals: r.goals,
    formation: r.formation,
  });
  report.matchTeams.created += (
    await tx.matchTeam.createMany({ data: teams.create.map(teamData) })
  ).count;
  for (const row of teams.update) {
    const data = teamData(row);
    await tx.matchTeam.update({
      where: { matchId_side: { matchId: data.matchId, side: row.side } },
      data,
    });
    report.matchTeams.updated += 1;
  }
  // New teams have ids only now
  const teamIds = (await matchIds(tx, slugs)).teams;

  // A side's XI is rewritten whole (§ 2.9)
  const players = await playerIds(tx, [
    ...new Set([
      ...lineups.create.map((r) => r.player),
      ...events.create.flatMap((r) => (r.player ? [r.player] : [])),
    ]),
  ]);
  const sides = groupBy(
    [...lineups.create, ...lineups.delete],
    (r) => `${r.match}|${r.side}`,
  );
  for (const key of sides.keys()) {
    const matchTeamId = idOf(teamIds, key);
    report.lineups.deleted += (
      await tx.lineup.deleteMany({ where: { matchTeamId } })
    ).count;
    const rows = lineups.create.filter((r) => `${r.match}|${r.side}` === key);
    report.lineups.created += (
      await tx.lineup.createMany({
        data: rows.map((r) => ({
          matchTeamId,
          playerId: idOf(players, r.player),
          slot: r.slot,
          position: r.position,
        })),
      })
    ).count;
  }

  // A match's events are replaced whole (§ 2.10)
  const byMatch = groupBy([...events.create, ...events.delete], (r) => r.match);
  for (const slug of byMatch.keys()) {
    const matchId = idOf(ids.matches, slug);
    report.matchEvents.deleted += (
      await tx.matchEvent.deleteMany({ where: { matchId } })
    ).count;
    report.matchEvents.created += (
      await tx.matchEvent.createMany({
        data: events.create
          .filter((r) => r.match === slug)
          .map((r) => ({
            matchId,
            kind: r.kind,
            minute: r.minute,
            addedTime: r.addedTime,
            side: r.side,
            playerId: r.player ? idOf(players, r.player) : null,
          })),
      })
    ).count;
  }

  const scoreData = (r: ScoreRow) => ({
    score: r.score,
    signals: JSON.parse(r.signals) as Prisma.InputJsonValue,
    algorithmVersion: r.algorithmVersion,
    computedAt: new Date(r.computedAt),
  });
  report.memorabilityScores.created += (
    await tx.memorabilityScore.createMany({
      data: scores.create.map((r) => ({
        matchId: idOf(ids.matches, r.match),
        ...scoreData(r),
      })),
    })
  ).count;
  for (const row of scores.update) {
    await tx.memorabilityScore.update({
      where: { matchId: idOf(ids.matches, row.match) },
      data: scoreData(row),
    });
    report.memorabilityScores.updated += 1;
  }
}

// D2: the score row only; the match stays
async function retire(tx: Tx, chunk: Chunk, report: ApplyReport) {
  report.memorabilityScores.deleted += (
    await tx.memorabilityScore.deleteMany({
      where: { match: { slug: { in: chunk.retired } } },
    })
  ).count;
}

async function writeChunk(tx: Tx, chunk: Chunk, report: ApplyReport) {
  if (chunk.tables.competitions) await writeParents(tx, chunk, report);
  if (chunk.tables.players) await writePlayers(tx, chunk, report);
  if (chunk.tables.matches) await writeMatches(tx, chunk, report);
  if (chunk.retired.length > 0) await retire(tx, chunk, report);
}

// One transaction per chunk, in order (D1)
export async function applyChunks(
  prisma: PrismaClient,
  chunks: readonly Chunk[],
  onChunk: (name: string) => void = () => {},
): Promise<ApplyReport> {
  const report = emptyReport();
  for (const chunk of chunks) {
    await prisma.$transaction(
      (tx) => writeChunk(tx, chunk, report),
      TRANSACTION,
    );
    onChunk(chunk.name);
  }
  return report;
}
