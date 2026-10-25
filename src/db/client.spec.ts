import type { Env } from '@/config/env.schema.js';
import { createPrismaClient } from '@/db/client.js';

// Nothing connects until the first query
const DATABASE_URL = 'postgresql://lineup:secret@db.example.com/neondb';

describe('createPrismaClient', () => {
  it.each(['ingest', 'disposable'] as const)(
    'creates a client for %s',
    async (target) => {
      const env: Env = { DATABASE_URL, LOAD_TARGET: target };
      const prisma = createPrismaClient(env);
      await prisma.$disconnect();
    },
  );

  it('refuses production without an opt-in', () => {
    const env: Env = { DATABASE_URL, LOAD_TARGET: 'production' };
    expect(() => createPrismaClient(env)).toThrow(/LOAD_TARGET=production/);
    expect(() => createPrismaClient(env, { allowProduction: false })).toThrow();
  });

  it('creates a production client with the opt-in', async () => {
    const env: Env = { DATABASE_URL, LOAD_TARGET: 'production' };
    const prisma = createPrismaClient(env, { allowProduction: true });
    await prisma.$disconnect();
  });
});
