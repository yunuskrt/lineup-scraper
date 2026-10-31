import { timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import { isOwnOrigin } from '@/dashboard/host.js';

export const TOKEN_HEADER = 'x-dashboard-token';

function isSameToken(given: string, token: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Only the page this server served can act
export function checkActionHeaders(
  headers: IncomingHttpHeaders,
  token: string,
  port: number,
): string | null {
  if (!isOwnOrigin(headers.origin, port)) return 'foreign origin';
  const given = headers[TOKEN_HEADER];
  if (typeof given !== 'string' || !isSameToken(given, token)) {
    return 'missing or wrong token';
  }
  return null;
}
