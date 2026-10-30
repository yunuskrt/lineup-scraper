import { loadEnv } from '@/config/load-env.js';
import {
  CONTENT_TABLES,
  type PrefixSize,
  type SizesInput,
  type TableSize,
} from '@/dashboard/sizes.js';
import { createPrismaClient } from '@/db/client.js';
import type { PrismaClient } from '@/generated/prisma/client.js';
import { openTargetStore } from '@/load/images.js';
import { IMAGE_PREFIXES } from '@/storage/keys.js';

const NO_ARGS = { apply: false, target: null, confirm: false };

function counts(prisma: PrismaClient): Promise<number[]> {
  return Promise.all([
    prisma.competition.count(),
    prisma.season.count(),
    prisma.club.count(),
    prisma.clubAlias.count(),
    prisma.player.count(),
    prisma.playerAlias.count(),
    prisma.match.count(),
    prisma.matchTeam.count(),
    prisma.lineup.count(),
    prisma.matchEvent.count(),
    prisma.memorabilityScore.count(),
  ]);
}

// SELECTs only
async function readTables(
  prisma: PrismaClient,
): Promise<{ tables: TableSize[]; databaseBytes: number }> {
  const names = [...CONTENT_TABLES];
  const [rows, relations, database] = await Promise.all([
    counts(prisma),
    prisma.$queryRaw<{ name: string; bytes: bigint }[]>`
      SELECT c.relname AS name, pg_total_relation_size(c.oid) AS bytes
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND c.relname = ANY(${names})`,
    prisma.$queryRaw<{ bytes: bigint }[]>`
      SELECT pg_database_size(current_database()) AS bytes`,
  ]);
  const bytes = new Map(relations.map((r) => [r.name, Number(r.bytes)]));
  return {
    tables: CONTENT_TABLES.map((table, i) => ({
      table,
      rows: rows[i] ?? 0,
      bytes: bytes.get(table) ?? 0,
    })),
    databaseBytes: Number(database[0]?.bytes ?? 0),
  };
}

async function readBucket(
  target: Parameters<typeof openTargetStore>[0],
  notes: string[],
): Promise<PrefixSize[] | null> {
  const opened = openTargetStore(target, NO_ARGS);
  if (!opened.success) {
    notes.push(`bucket not read: ${opened.error.split('\n')[0]}`);
    return null;
  }
  return Promise.all(
    Object.values(IMAGE_PREFIXES).map(async (name) => {
      const prefix = `${name}/`;
      return { prefix, ...(await opened.store.measure(prefix)) };
    }),
  );
}

// Never production; read only
export async function readSizes(): Promise<SizesInput> {
  const notes: string[] = [];
  const env = loadEnv();
  if (!env.success) {
    notes.push('not read: .env has no valid DATABASE_URL');
    return {
      target: '?',
      tables: null,
      databaseBytes: null,
      bucket: null,
      notes,
    };
  }
  const target = env.data.LOAD_TARGET;
  if (target === 'production') {
    notes.push('not read: the dashboard never reads production');
    return { target, tables: null, databaseBytes: null, bucket: null, notes };
  }
  const prisma = createPrismaClient(env.data);
  try {
    const [{ tables, databaseBytes }, bucket] = await Promise.all([
      readTables(prisma),
      readBucket(target, notes),
    ]);
    return { target, tables, databaseBytes, bucket, notes };
  } finally {
    await prisma.$disconnect();
  }
}
