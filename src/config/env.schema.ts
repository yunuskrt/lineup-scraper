import { z } from 'zod';

// dev holds the mock seed: real data never goes there
export const LOAD_TARGETS = ['ingest', 'disposable', 'production'] as const;

export const envSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  // A label for DATABASE_URL's branch, not checked
  LOAD_TARGET: z.enum(LOAD_TARGETS).default('ingest'),
});

export type Env = z.infer<typeof envSchema>;
export type LoadTarget = Env['LOAD_TARGET'];

// AWS names, as the Neon console gives them
export const storageEnvSchema = z.object({
  AWS_ENDPOINT_URL_S3: z.url({ protocol: /^https$/ }),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_REGION: z.string().min(1),
  STORAGE_BUCKET: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/)
    .default('images'),
});

export type StorageEnv = z.infer<typeof storageEnvSchema>;
