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
