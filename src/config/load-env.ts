import {
  parseEnv,
  parseStorageEnv,
  type ParseEnvResult,
  type ParseStorageEnvResult,
} from '@/config/parse-env.js';

let cached: ParseEnvResult | undefined;
let cachedStorage: ParseStorageEnvResult | undefined;

export function loadEnv(): ParseEnvResult {
  cached ??= parseEnv(process.env);
  return cached;
}

export function loadStorageEnv(): ParseStorageEnvResult {
  cachedStorage ??= parseStorageEnv(process.env);
  return cachedStorage;
}
