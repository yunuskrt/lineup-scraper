import { z } from 'zod';
import { groupsFor, type PoolGroup, type PoolRules } from '@/pool/groups.js';
import { digitsSchema } from '@/raw/envelope.js';
import {
  transfermarktFixtureSchema,
  type TransfermarktFixture,
} from '@/raw/transfermarkt-fixture.js';

// pool-include.json and excluded-matches.json
export const matchListSchema = z.array(
  z.strictObject({ sourceId: digitsSchema, note: z.string().trim().min(1) }),
);
export type MatchList = z.infer<typeof matchListSchema>;

// Names the file and line, never the record
export function parseFixtureLine(
  line: string,
  at: string,
): TransfermarktFixture {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    throw new Error(`Invalid JSON in fixture records: ${at}`);
  }
  const parsed = transfermarktFixtureSchema.safeParse(value);
  if (!parsed.success) throw new Error(`Invalid fixture record: ${at}`);
  return parsed.data;
}

export type MatchGroup = PoolGroup | 'included';

// Keys in alphabetical order: the file's key order
export interface PoolMatch {
  away: string;
  competitionCode: string;
  date: string | null;
  groups: MatchGroup[];
  home: string;
  result: string | null;
  round: string | null;
  seasonId: string | null;
  sourceId: string;
  stage: string | null;
}

export interface Conflict {
  sourceId: string;
  fields: string[];
}

export interface PoolBuild {
  matches: PoolMatch[];
  conflicts: Conflict[];
  excluded: string[];
  // Included ids no saved listing page has
  missingIncludes: string[];
}

// Two listing rows of one match must agree on these
const IDENTITY: Record<string, (row: TransfermarktFixture) => string | null> = {
  competitionCode: (row) => row.competitionCode,
  seasonId: (row) => row.seasonId,
  date: (row) => row.date,
  home: (row) => row.home.sourceId,
  away: (row) => row.away.sourceId,
};

function disagreements(rows: TransfermarktFixture[]): string[] {
  const [first, ...rest] = rows;
  if (!first) return [];
  return Object.entries(IDENTITY)
    .filter(([, read]) => rest.some((row) => read(row) !== read(first)))
    .map(([name]) => name);
}

function toMatch(row: TransfermarktFixture, groups: MatchGroup[]): PoolMatch {
  return {
    away: row.away.sourceId,
    competitionCode: row.competitionCode,
    date: row.date,
    groups,
    home: row.home.sourceId,
    result: row.result,
    round: row.round,
    seasonId: row.seasonId,
    sourceId: row.sourceId,
    stage: row.stage,
  };
}

// By date, undated last, then by numeric id
function byDateThenId(a: PoolMatch, b: PoolMatch): number {
  if (a.date !== b.date) {
    if (a.date === null) return 1;
    if (b.date === null) return -1;
    return a.date < b.date ? -1 : 1;
  }
  return Number(a.sourceId) - Number(b.sourceId);
}

export function buildPool(
  rows: TransfermarktFixture[],
  rules: PoolRules,
  include: MatchList,
  exclude: MatchList,
): PoolBuild {
  const byId = new Map<string, TransfermarktFixture[]>();
  for (const row of rows) {
    byId.set(row.sourceId, [...(byId.get(row.sourceId) ?? []), row]);
  }
  const included = new Set(include.map((item) => item.sourceId));
  const excludedIds = new Set(exclude.map((item) => item.sourceId));
  const result: PoolBuild = {
    matches: [],
    conflicts: [],
    excluded: [],
    missingIncludes: [],
  };
  for (const [sourceId, copies] of byId) {
    const first = copies[0]!;
    const groups: MatchGroup[] = groupsFor(first, rules);
    if (included.has(sourceId)) groups.push('included');
    // Any copy in a group makes a disagreement worth reporting
    const isCandidate =
      groups.length > 0 ||
      copies.some((row) => groupsFor(row, rules).length > 0);
    if (!isCandidate) continue;
    const fields = disagreements(copies);
    if (fields.length > 0) {
      result.conflicts.push({ sourceId, fields });
    } else if (excludedIds.has(sourceId)) {
      result.excluded.push(sourceId);
    } else {
      result.matches.push(toMatch(first, groups.toSorted()));
    }
  }
  result.matches.sort(byDateThenId);
  result.conflicts.sort((a, b) => Number(a.sourceId) - Number(b.sourceId));
  result.excluded.sort((a, b) => Number(a) - Number(b));
  result.missingIncludes = [...included]
    .filter((id) => !byId.has(id))
    .toSorted((a, b) => Number(a) - Number(b));
  return result;
}

export function renderMatches(matches: PoolMatch[]): string {
  return `${JSON.stringify(matches, null, 2)}\n`;
}
