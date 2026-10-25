import { PrismaPg } from '@prisma/adapter-pg';
import type { Env } from '@/config/env.schema.js';
import { PrismaClient } from '@/generated/prisma/client.js';

export type ClientOptions = {
  allowProduction?: boolean;
};

export function createPrismaClient(
  env: Env,
  { allowProduction = false }: ClientOptions = {},
): PrismaClient {
  if (env.LOAD_TARGET === 'production' && !allowProduction) {
    throw new Error('Refusing LOAD_TARGET=production without an opt-in');
  }
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: env.DATABASE_URL,
      connectionTimeoutMillis: 10_000,
    }),
    log: ['warn', 'error'],
    errorFormat: 'minimal',
  });
}
