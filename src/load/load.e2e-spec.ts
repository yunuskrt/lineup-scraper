import { existsSync, readFileSync } from 'node:fs';
import { DATA_DIRS } from '@/config/data-dirs.js';
import { loadEnv } from '@/config/load-env.js';
import { positionForSlot } from '@/dataset/formation.js';
import type { DatasetInput } from '@/dataset/schema.js';
import { createPrismaClient } from '@/db/client.js';
import type { PrismaClient } from '@/generated/prisma/client.js';
import { applyChunks } from '@/load/apply.js';
import { planChunks } from '@/load/chunks.js';
import { planLoad } from '@/load/plan.js';
import { preflight } from '@/load/preflight.js';
import { readStored } from '@/load/read.js';
import { changeCount } from '@/load/report.js';
import { wantedRows } from '@/load/rows.js';

const SCHEMA = new URL('../../prisma/schema.prisma', import.meta.url);
const DERBY = '2002-11-06-fenerbahce-galatasaray';
const FINAL = '2001-05-23-bayern-munich-valencia';

let prisma: PrismaClient;
let pilot: DatasetInput;

async function load(dataset: DatasetInput) {
  const wanted = wantedRows(dataset);
  const plan = planLoad(wanted, await readStored(prisma, wanted));
  const report = await applyChunks(prisma, planChunks(plan, wanted));
  return { plan, report };
}

async function counts() {
  return {
    competitions: await prisma.competition.count(),
    seasons: await prisma.season.count(),
    clubs: await prisma.club.count(),
    clubAliases: await prisma.clubAlias.count(),
    players: await prisma.player.count(),
    playerAliases: await prisma.playerAlias.count(),
    matches: await prisma.match.count(),
    matchTeams: await prisma.matchTeam.count(),
    lineups: await prisma.lineup.count(),
    matchEvents: await prisma.matchEvent.count(),
    memorabilityScores: await prisma.memorabilityScore.count(),
  };
}

// Each row's id and updated_at: did any move?
async function stamps() {
  const rows = [
    ...(await prisma.player.findMany({
      select: { id: true, updatedAt: true },
    })),
    ...(await prisma.playerAlias.findMany({
      select: { id: true, updatedAt: true },
    })),
    ...(await prisma.match.findMany({ select: { id: true, updatedAt: true } })),
    ...(await prisma.lineup.findMany({
      select: { id: true, updatedAt: true },
    })),
    ...(await prisma.matchEvent.findMany({
      select: { id: true, updatedAt: true },
    })),
    ...(await prisma.memorabilityScore.findMany({
      select: { id: true, updatedAt: true },
    })),
  ];
  return rows.map((r) => `${r.id}@${r.updatedAt.toISOString()}`).toSorted();
}

function edited(change: (copy: DatasetInput) => void): DatasetInput {
  const copy = structuredClone(pilot);
  change(copy);
  return copy;
}

describe('load into a disposable branch', () => {
  beforeAll(() => {
    if (existsSync('.env')) process.loadEnvFile('.env');
    const env = loadEnv();
    if (!env.success) throw new Error('Invalid environment');
    // Never a shared branch (coding standards)
    if (env.data.LOAD_TARGET !== 'disposable') {
      throw new Error('test:e2e runs only with LOAD_TARGET=disposable');
    }
    const checked = preflight(DATA_DIRS.dataset, readFileSync(SCHEMA, 'utf8'));
    if (!checked.success) throw new Error(checked.error);
    pilot = checked.dataset;
    prisma = createPrismaClient(env.data);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('starts from an empty branch', async () => {
    expect(Object.values(await counts()).every((n) => n === 0)).toBe(true);
  });

  it('loads the pilot, and the database holds exactly its rows', async () => {
    const { report } = await load(pilot);
    expect(await counts()).toEqual({
      competitions: 3,
      seasons: 3,
      clubs: 6,
      clubAliases: 3,
      players: 65,
      playerAliases: 164,
      matches: 3,
      matchTeams: 6,
      lineups: 66,
      matchEvents: 13,
      memorabilityScores: 3,
    });
    expect(report.lineups).toEqual({ created: 66, updated: 0, deleted: 0 });
    const match = await prisma.match.findUniqueOrThrow({
      where: { slug: FINAL },
    });
    expect(match).toMatchObject({
      transfermarktId: '990248',
      extraTime: true,
      shootoutHome: 5,
      shootoutAway: 4,
    });
    expect(match.date.toISOString()).toBe('2001-05-23T00:00:00.000Z');
    // The dataset's image keys, exactly (S18b)
    const kahn = await prisma.player.findUniqueOrThrow({
      where: { slug: 'oliver-kahn' },
    });
    const wanted = pilot.players.find((p) => p.slug === 'oliver-kahn')!;
    expect(kahn.imageKey).toBe(wanted.imageKey);
    expect(kahn.imageKey).toMatch(/^players\/oliver-kahn\/[0-9a-f]{12}\.webp$/);
    expect(await prisma.player.count({ where: { imageKey: null } })).toBe(0);
    expect(await prisma.club.count({ where: { crestKey: null } })).toBe(0);
  });

  it('writes nothing on a rerun, and every updated_at stays', async () => {
    const before = await stamps();
    const { plan } = await load(pilot);
    expect(changeCount(plan)).toBe(0);
    expect(await stamps()).toEqual(before);
  });

  it('rewrites only the side whose two slots swapped', async () => {
    const away = await prisma.lineup.findMany({
      where: { matchTeam: { match: { slug: DERBY }, side: 'away' } },
      select: { id: true },
    });
    const swapped = edited((copy) => {
      const home = copy.matches.find((m) => m.slug === DERBY)!.home.lineup;
      [home[1].playerSlug, home[2].playerSlug] = [
        home[2].playerSlug,
        home[1].playerSlug,
      ];
    });
    const { plan, report } = await load(swapped);
    expect(plan.rewrittenSides).toEqual([`${DERBY}|home`]);
    expect(report.lineups).toEqual({ created: 11, updated: 0, deleted: 11 });
    const awayAfter = await prisma.lineup.findMany({
      where: { matchTeam: { match: { slug: DERBY }, side: 'away' } },
      select: { id: true },
    });
    expect(awayAfter).toEqual(away);
    pilot = swapped;
  });

  it('deletes a removed alias and updates a changed score, one row each', async () => {
    const changed = edited((copy) => {
      const kahn = copy.players.find((p) => p.slug === 'oliver-kahn')!;
      kahn.aliases = kahn.aliases.filter((a) => a !== 'Kahn');
      copy.matches.find((m) => m.slug === FINAL)!.memorability.score = 99.5;
    });
    const { report } = await load(changed);
    expect(report.playerAliases).toEqual({
      created: 0,
      updated: 0,
      deleted: 1,
    });
    expect(report.memorabilityScores).toEqual({
      created: 0,
      updated: 1,
      deleted: 0,
    });
    expect(changeCount((await load(changed)).plan)).toBe(0);
    pilot = changed;
  });

  it('updates an alias text, swaps a club alias, replaces events', async () => {
    const changed = edited((copy) => {
      const pirlo = copy.players.find((p) => p.slug === 'andrea-pirlo')!;
      // Same normalised form: an update, not a new row
      pirlo.aliases = pirlo.aliases.map((a) => (a === 'Pirlo' ? 'PIRLO' : a));
      copy.clubs.find((c) => c.slug === 'valencia')!.aliases = ['Valencia'];
      const final = copy.matches.find((m) => m.slug === FINAL)!;
      final.events = final.events.slice(1);
    });
    const { report } = await load(changed);
    expect(report.playerAliases).toEqual({
      created: 0,
      updated: 1,
      deleted: 0,
    });
    expect(report.clubAliases).toEqual({ created: 1, updated: 0, deleted: 1 });
    expect(report.matchEvents).toEqual({ created: 1, updated: 0, deleted: 2 });
    const alias = await prisma.playerAlias.findFirstOrThrow({
      where: { player: { slug: 'andrea-pirlo' }, normalized: 'pirlo' },
    });
    expect(alias.alias).toBe('PIRLO');
    expect(changeCount((await load(changed)).plan)).toBe(0);
    pilot = changed;
  });

  it('retires a match that left: its score row goes, the match stays', async () => {
    const without = edited((copy) => {
      copy.matches = copy.matches.filter((m) => m.slug !== DERBY);
    });
    const { plan, report } = await load(without);
    expect(plan.retired).toEqual([DERBY]);
    expect(report.memorabilityScores.deleted).toBe(1);
    expect(await prisma.match.count({ where: { slug: DERBY } })).toBe(1);
    expect(
      await prisma.memorabilityScore.count({
        where: { match: { slug: DERBY } },
      }),
    ).toBe(0);
  });

  it('keeps every play-time rule for both sides of every scored match', async () => {
    const scored = await prisma.match.findMany({
      where: { memorability: { isNot: null } },
      include: {
        teams: {
          include: {
            lineups: { include: { player: { include: { aliases: true } } } },
          },
        },
      },
    });
    expect(scored).toHaveLength(2);
    for (const match of scored) {
      expect(match.teams).toHaveLength(2);
      for (const team of match.teams) {
        expect(team.formation).not.toBeNull();
        expect(team.lineups).toHaveLength(11);
        for (const row of team.lineups) {
          expect(row.position).toBe(positionForSlot(team.formation!, row.slot));
          expect(row.player.aliases.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
