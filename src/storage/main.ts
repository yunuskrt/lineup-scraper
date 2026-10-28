import { existsSync } from 'node:fs';
import { loadEnv, loadStorageEnv } from '@/config/load-env.js';
import { formatEnvIssues } from '@/config/parse-env.js';
import { parseArgs } from '@/load/target.js';
import { createObjectStore } from '@/storage/client.js';
import { IMAGE_KINDS, IMAGE_PREFIXES } from '@/storage/keys.js';
import { checkStorageTarget } from '@/storage/target.js';

async function main(argv: string[]): Promise<number> {
  // tsx doesn't read .env itself
  if (existsSync('.env')) process.loadEnvFile('.env');
  const env = loadEnv();
  const storageEnv = loadStorageEnv();
  if (!env.success || !storageEnv.success) {
    const issues = [
      ...(env.success ? [] : env.error),
      ...(storageEnv.success ? [] : storageEnv.error),
    ];
    console.error(formatEnvIssues(issues));
    return 1;
  }
  const args = parseArgs(argv);
  if (!args.success || args.args.apply) {
    console.error(args.success ? 'npm run storage only reads' : args.error);
    return 2;
  }
  const target = env.data.LOAD_TARGET;
  const guard = checkStorageTarget(
    target,
    storageEnv.data.AWS_ENDPOINT_URL_S3,
    args.args,
  );
  if (!guard.success) {
    console.error(guard.error);
    return 1;
  }

  const store = createObjectStore(storageEnv.data);
  await store.checkBucket();
  console.log(`target ${target}, bucket ${storageEnv.data.STORAGE_BUCKET}`);
  for (const kind of IMAGE_KINDS) {
    const prefix = IMAGE_PREFIXES[kind];
    console.log(`${prefix}: ${await store.countObjects(`${prefix}/`)} objects`);
  }
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    // The SDK's name, never a credential
    console.error(
      `Storage check failed: ${error instanceof Error ? error.name : 'unknown error'}`,
    );
    process.exitCode = 1;
  },
);
