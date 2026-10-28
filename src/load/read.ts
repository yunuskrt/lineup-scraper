import type { PrismaClient } from '@/generated/prisma/client.js';
import type { StoredState } from '@/load/plan.js';
import { canonicalJson, type ContentRows } from '@/load/rows.js';

// SELECTs only, by the dataset's natural keys
export async function readStored(
  prisma: PrismaClient,
  wanted: ContentRows,
): Promise<StoredState> {
  const slugs = (rows: { slug: string }[]) => rows.map((row) => row.slug);
  const competitions = await prisma.competition.findMany({
    where: { slug: { in: slugs(wanted.competitions) } },
    include: { seasons: true },
  });
  const clubs = await prisma.club.findMany({
    where: { slug: { in: slugs(wanted.clubs) } },
    include: { aliases: true },
  });
  const players = await prisma.player.findMany({
    where: { slug: { in: slugs(wanted.players) } },
    include: { aliases: true },
  });
  const matches = await prisma.match.findMany({
    where: { slug: { in: slugs(wanted.matches) } },
    include: {
      season: { include: { competition: true } },
      teams: {
        include: { club: true, lineups: { include: { player: true } } },
      },
      events: { include: { player: true } },
      memorability: true,
    },
  });
  // D2: ours, gone from the dataset, still scored
  const retirable = await prisma.match.findMany({
    where: {
      transfermarktId: { not: null },
      slug: { notIn: slugs(wanted.matches) },
      memorability: { isNot: null },
    },
    select: { id: true, slug: true, memorability: true },
  });
  // D3: match ids only, read never written
  const idToSlug = new Map(
    [...matches, ...retirable].map((m) => [m.id, m.slug]),
  );
  const sessions = await prisma.gameSession.groupBy({
    by: ['matchId'],
    where: { matchId: { in: [...idToSlug.keys()] } },
    _count: { _all: true },
  });

  const rows: ContentRows = {
    competitions: competitions.map(({ slug, kind, name }) => ({
      slug,
      kind,
      name,
    })),
    seasons: competitions.flatMap((c) =>
      c.seasons.map((s) => ({
        competition: c.slug,
        label: s.label,
        startYear: s.startYear,
      })),
    ),
    clubs: clubs.map((c) => ({
      slug: c.slug,
      kind: c.kind,
      name: c.name,
      shortName: c.shortName,
      crestKey: c.crestKey,
      transfermarktId: c.transfermarktId,
    })),
    clubAliases: clubs.flatMap((c) =>
      c.aliases.map((a) => ({ club: c.slug, alias: a.alias })),
    ),
    players: players.map((p) => ({
      slug: p.slug,
      name: p.name,
      imageKey: p.imageKey,
      transfermarktId: p.transfermarktId,
    })),
    playerAliases: players.flatMap((p) =>
      p.aliases.map((a) => ({
        player: p.slug,
        alias: a.alias,
        normalized: a.normalized,
      })),
    ),
    matches: matches.map((m) => ({
      slug: m.slug,
      competition: m.season.competition.slug,
      season: m.season.label,
      date: m.date.toISOString().slice(0, 10),
      stage: m.stage,
      nickname: m.nickname,
      extraTime: m.extraTime,
      shootoutHome: m.shootoutHome,
      shootoutAway: m.shootoutAway,
      transfermarktId: m.transfermarktId,
    })),
    matchTeams: matches.flatMap((m) =>
      m.teams.map((t) => ({
        match: m.slug,
        side: t.side,
        club: t.club.slug,
        goals: t.goals,
        formation: t.formation,
      })),
    ),
    lineups: matches.flatMap((m) =>
      m.teams.flatMap((t) =>
        t.lineups.map((l) => ({
          match: m.slug,
          side: t.side,
          slot: l.slot,
          player: l.player.slug,
          position: l.position,
        })),
      ),
    ),
    matchEvents: matches.flatMap((m) =>
      m.events.map((e) => ({
        match: m.slug,
        kind: e.kind,
        minute: e.minute,
        addedTime: e.addedTime,
        side: e.side,
        player: e.player?.slug ?? null,
      })),
    ),
    memorabilityScores: [...matches, ...retirable].flatMap((m) =>
      m.memorability
        ? [
            {
              match: m.slug,
              score: m.memorability.score,
              signals: canonicalJson(m.memorability.signals),
              algorithmVersion: m.memorability.algorithmVersion,
              computedAt: m.memorability.computedAt.toISOString(),
            },
          ]
        : [],
    ),
  };
  return {
    rows,
    retirable: slugs(retirable),
    sessions: new Map(
      sessions.map((s) => [idToSlug.get(s.matchId) ?? '', s._count._all]),
    ),
  };
}
