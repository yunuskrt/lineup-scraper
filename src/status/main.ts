import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { DATA_DIRS } from '@/config/data-dirs.js';
import { loadEnv } from '@/config/load-env.js';
import { createPrismaClient } from '@/db/client.js';
import { readImageKeys } from '@/images/keys.js';
import { missingImages, openTargetStore } from '@/load/images.js';
import { preflight } from '@/load/preflight.js';
import {
  remoteStatus,
  type GateResult,
  type RemoteInput,
  type StoredRows,
} from '@/status/remote.js';

const SCHEMA_FILE = new URL('../../prisma/schema.prisma', import.meta.url);
const GATE_FILE = path.join(DATA_DIRS.work, 'gate', 'matches.json');
const RESOLVED_FILE = path.join(DATA_DIRS.work, 'resolved', 'matches.json');
const REMOTE_FILE = path.join(DATA_DIRS.work, 'status', 'remote.json');
const NO_ARGS = { apply: false, target: null, confirm: false };

const gateSchema = z.array(
  z.object({
    slug: z.string(),
    failures: z.array(z.object({ at: z.string(), rule: z.string() })),
  }),
);
const resolvedSchema = z.array(
  z.object({ slug: z.string(), transfermarktId: z.string() }),
);

function readJson<T>(file: string, schema: z.ZodType<T>): T | null {
  if (!existsSync(file)) return null;
  return schema.parse(JSON.parse(readFileSync(file, 'utf8')));
}

// Gate results keyed by Transfermarkt id
function readGate(): GateResult[] {
  const gate = readJson(GATE_FILE, gateSchema) ?? [];
  const resolved = readJson(RESOLVED_FILE, resolvedSchema) ?? [];
  const ids = new Map(resolved.map((m) => [m.slug, m.transfermarktId]));
  return gate.flatMap(({ slug, failures }) => {
    const transfermarktId = ids.get(slug);
    return transfermarktId ? [{ transfermarktId, failures }] : [];
  });
}

function readDataset(notes: string[]): RemoteInput['dataset'] {
  const checked = preflight(
    DATA_DIRS.dataset,
    readFileSync(SCHEMA_FILE, 'utf8'),
  );
  if (!checked.success) {
    notes.push(`dataset not read, nothing validated: ${checked.error}`);
    return null;
  }
  const ids = (rows: { transfermarktId: string | null }[]) =>
    rows.flatMap((r) => (r.transfermarktId ? [r.transfermarktId] : []));
  return {
    matches: ids(checked.dataset.matches),
    players: ids(checked.dataset.players),
  };
}

// SELECTs only, of our rows
async function readDatabase(notes: string[]): Promise<StoredRows | null> {
  const env = loadEnv();
  if (!env.success) {
    notes.push('database not checked: .env has no valid DATABASE_URL');
    return null;
  }
  if (env.data.LOAD_TARGET === 'production') {
    notes.push('database not checked: status never reads production');
    return null;
  }
  const prisma = createPrismaClient(env.data);
  try {
    const ours = { transfermarktId: { not: null } };
    const [matches, players, clubs] = await Promise.all([
      prisma.match.findMany({ where: ours, select: { transfermarktId: true } }),
      prisma.player.findMany({
        where: ours,
        select: { transfermarktId: true, imageKey: true },
      }),
      prisma.club.findMany({
        where: ours,
        select: { transfermarktId: true, crestKey: true },
      }),
    ]);
    const id = (row: { transfermarktId: string | null }) =>
      row.transfermarktId ?? '';
    return {
      matches: matches.map(id),
      players: players.map(id),
      crestKeys: new Map(clubs.map((c) => [id(c), c.crestKey])),
      photoKeys: new Map(players.map((p) => [id(p), p.imageKey])),
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function readBucket(
  keys: string[],
  notes: string[],
): Promise<Set<string> | null> {
  const env = loadEnv();
  if (!env.success) {
    notes.push('bucket not checked: .env has no valid LOAD_TARGET');
    return null;
  }
  if (env.data.LOAD_TARGET === 'production') {
    notes.push('bucket not checked: status never reads production');
    return null;
  }
  const opened = openTargetStore(env.data.LOAD_TARGET, NO_ARGS);
  if (!opened.success) {
    notes.push(`bucket not checked: ${opened.error.split('\n')[0]}`);
    return null;
  }
  const absent = new Set(await missingImages(opened.store, keys));
  return new Set(keys.filter((key) => !absent.has(key)));
}

async function main(): Promise<number> {
  // tsx doesn't read .env itself
  if (existsSync('.env')) process.loadEnvFile('.env');
  const notes: string[] = [];
  const keys = readImageKeys();
  const status = remoteStatus({
    dataset: readDataset(notes),
    gate: readGate(),
    keys,
    bucket: await readBucket(
      [...keys.crests, ...keys.photos].map((e) => e.key),
      notes,
    ),
    database: await readDatabase(notes),
    notes,
  });
  mkdirSync(path.dirname(REMOTE_FILE), { recursive: true });
  writeFileSync(REMOTE_FILE, `${JSON.stringify(status, null, 2)}\n`);
  for (const note of notes) console.log(note);
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    // Prisma's minimal format names no value
    console.error(
      `Status failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  },
);
