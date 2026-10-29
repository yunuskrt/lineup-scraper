import type { PrismaClient } from '@/generated/prisma/client.js';
import type { Expected, VerifyState } from '@/verify/check.js';

// SELECTs only: dataset slugs, served matches
export async function readState(
  prisma: PrismaClient,
  expected: Expected,
): Promise<VerifyState> {
  const competitions = await prisma.competition.findMany({
    orderBy: { slug: 'asc' },
    where: { slug: { in: expected.competitions } },
    select: { slug: true },
  });
  const clubs = await prisma.club.findMany({
    orderBy: { slug: 'asc' },
    where: { slug: { in: expected.clubs } },
    select: { slug: true, crestKey: true },
  });
  const players = await prisma.player.findMany({
    orderBy: { slug: 'asc' },
    where: { slug: { in: expected.players } },
    select: {
      slug: true,
      imageKey: true,
      aliases: { select: { alias: true, normalized: true } },
    },
  });
  const matches = await prisma.match.findMany({
    orderBy: { slug: 'asc' },
    where: {
      OR: [
        { slug: { in: expected.matches } },
        { transfermarktId: { not: null }, memorability: { isNot: null } },
      ],
    },
    select: {
      slug: true,
      season: { select: { competition: { select: { kind: true } } } },
      memorability: { select: { score: true, signals: true } },
      _count: { select: { events: true } },
      teams: {
        orderBy: { side: 'asc' },
        select: {
          side: true,
          formation: true,
          lineups: {
            select: {
              slot: true,
              position: true,
              player: { select: { _count: { select: { aliases: true } } } },
            },
          },
        },
      },
    },
  });
  return {
    competitions: competitions.map((c) => c.slug),
    clubs,
    players,
    matches: matches.map((m) => ({
      slug: m.slug,
      kind: m.season.competition.kind,
      score: m.memorability?.score ?? null,
      signals: m.memorability?.signals ?? null,
      events: m._count.events,
      teams: m.teams.map((t) => ({
        side: t.side,
        formation: t.formation,
        lineups: t.lineups.map((l) => ({
          slot: l.slot,
          position: l.position,
          aliasCount: l.player._count.aliases,
        })),
      })),
    })),
  };
}
