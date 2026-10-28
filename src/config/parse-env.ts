import type { z } from 'zod';
import {
  envSchema,
  storageEnvSchema,
  type Env,
  type StorageEnv,
} from '@/config/env.schema.js';

export type EnvIssue = {
  key: string;
  reason: string;
};

type Parsed<T> =
  { success: true; data: T } | { success: false; error: EnvIssue[] };

export type ParseEnvResult = Parsed<Env>;
export type ParseStorageEnvResult = Parsed<StorageEnv>;

function parseWith<T>(
  schema: z.ZodType<T>,
  raw: Record<string, string | undefined>,
): Parsed<T> {
  const result = schema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: result.error.issues.map((issue) => ({
      key: issue.path.join('.'),
      reason: issue.message,
    })),
  };
}

export function parseEnv(
  raw: Record<string, string | undefined>,
): ParseEnvResult {
  return parseWith(envSchema, raw);
}

export function parseStorageEnv(
  raw: Record<string, string | undefined>,
): ParseStorageEnvResult {
  return parseWith(storageEnvSchema, raw);
}

export function formatEnvIssues(issues: EnvIssue[]): string {
  const lines = issues.map(({ key, reason }) => `  ${key}: ${reason}`);
  return ['Invalid environment:', ...lines].join('\n');
}
