import type { LoadTarget } from '@/config/env.schema.js';
import {
  checkTarget,
  type LoadArgs,
  type TargetResult,
} from '@/load/target.js';

// data-contract.md § 10
export const KNOWN_BRANCHES = {
  production: 'br-square-feather-b17d6fhc',
  ingest: 'br-steep-paper-b1z0rlqq',
  dev: 'br-noisy-queen-b1lzkl00',
} as const;

const STORAGE_HOST = /^(br-[a-z0-9-]+)\.storage\./;

export function endpointBranch(endpoint: string): string | null {
  try {
    return STORAGE_HOST.exec(new URL(endpoint).hostname)?.[1] ?? null;
  } catch {
    return null;
  }
}

// The endpoint's branch must be LOAD_TARGET's
export function checkStorageTarget(
  target: LoadTarget,
  endpoint: string,
  args: LoadArgs,
): TargetResult {
  const guard = checkTarget(target, args);
  if (!guard.success) return guard;
  const branch = endpointBranch(endpoint);
  if (branch === null) {
    return {
      success: false,
      error: 'AWS_ENDPOINT_URL_S3 names no Neon branch',
    };
  }
  const known = Object.values(KNOWN_BRANCHES) as string[];
  const isMatch =
    target === 'disposable'
      ? !known.includes(branch)
      : branch === KNOWN_BRANCHES[target];
  if (!isMatch) {
    return {
      success: false,
      error: `AWS_ENDPOINT_URL_S3 is not the ${target} branch's endpoint`,
    };
  }
  return guard;
}
