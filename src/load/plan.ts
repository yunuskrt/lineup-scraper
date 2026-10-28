import type {
  ContentRows,
  EventRow,
  LineupRow,
  ScoreRow,
} from '@/load/rows.js';

export const TABLES = [
  'competitions',
  'seasons',
  'clubs',
  'clubAliases',
  'players',
  'playerAliases',
  'matches',
  'matchTeams',
  'lineups',
  'matchEvents',
  'memorabilityScores',
] as const;
export type Table = (typeof TABLES)[number];

export interface TablePlan<T> {
  create: T[];
  update: T[];
  delete: T[];
  same: number;
}

export type Plan = { [K in Table]: TablePlan<ContentRows[K][number]> } & {
  // `match|side` keys of the XIs rewritten whole
  rewrittenSides: string[];
  // Matches whose events are replaced whole
  replacedEvents: string[];
  // Gone from the dataset: score row deleted
  retired: string[];
  // Rewritten or retired, and played
  played: string[];
};

export interface StoredState {
  rows: ContentRows;
  // Scraper-loaded matches gone from the dataset
  retirable: string[];
  // Game sessions per match slug
  sessions: ReadonlyMap<string, number>;
}

type Row = object;

// A wanted field the database holds otherwise
function differs(wanted: Row, stored: Row): boolean {
  const held = stored as Record<string, unknown>;
  return Object.entries(wanted).some(([key, value]) => value !== held[key]);
}

// The seed's `sync` as a plan: never writes
export function diffByKey<T extends Row>(
  wanted: readonly T[],
  stored: readonly T[],
  keyOf: (row: T) => string,
  { remove }: { remove: boolean },
): TablePlan<T> {
  const byKey = new Map(stored.map((row) => [keyOf(row), row]));
  const wantedKeys = new Set(wanted.map(keyOf));
  const plan: TablePlan<T> = { create: [], update: [], delete: [], same: 0 };
  for (const row of wanted) {
    const current = byKey.get(keyOf(row));
    if (!current) plan.create.push(row);
    else if (differs(row, current)) plan.update.push(row);
    else plan.same += 1;
  }
  if (remove) {
    plan.delete = stored.filter((row) => !wantedKeys.has(keyOf(row)));
  }
  return plan;
}

function groupBy<T>(rows: readonly T[], keyOf: (row: T) => string) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return groups;
}

// Order-free: events have no natural key
function sameGroup<T extends Row>(a: T[], b: T[]): boolean {
  const text = (rows: T[]) =>
    rows
      .map((row) =>
        JSON.stringify(
          Object.entries(row).toSorted(([a], [b]) => (a < b ? -1 : 1)),
        ),
      )
      .toSorted();
  return JSON.stringify(text(a)) === JSON.stringify(text(b));
}

// Groups rewritten whole when any row differs
function diffGroups<T extends Row>(
  wanted: readonly T[],
  stored: readonly T[],
  keyOf: (row: T) => string,
): { plan: TablePlan<T>; rewritten: string[] } {
  const wantedGroups = groupBy(wanted, keyOf);
  const storedGroups = groupBy(stored, keyOf);
  const plan: TablePlan<T> = { create: [], update: [], delete: [], same: 0 };
  const rewritten: string[] = [];
  // A group held but no longer wanted empties too
  for (const key of new Set([...wantedGroups.keys(), ...storedGroups.keys()])) {
    const rows = wantedGroups.get(key) ?? [];
    const held = storedGroups.get(key) ?? [];
    if (sameGroup(rows, held)) {
      plan.same += rows.length;
      continue;
    }
    plan.create.push(...rows);
    plan.delete.push(...held);
    if (held.length > 0) rewritten.push(key);
  }
  return { plan, rewritten };
}

const bySlug = (row: { slug: string }) => row.slug;
const sideKey = (row: LineupRow) => `${row.match}|${row.side}`;
const eventKey = (row: EventRow) => row.match;
const scoreKey = (row: ScoreRow) => row.match;

export function planLoad(wanted: ContentRows, stored: StoredState): Plan {
  const held = stored.rows;
  const lineups = diffGroups(wanted.lineups, held.lineups, sideKey);
  const events = diffGroups(wanted.matchEvents, held.matchEvents, eventKey);
  const rewrittenMatches = new Set(
    lineups.rewritten.map((key) => key.split('|')[0]),
  );
  const retired = stored.retirable.toSorted();
  const played = [...new Set([...rewrittenMatches, ...retired])]
    .filter((slug) => (stored.sessions.get(slug) ?? 0) > 0)
    .toSorted();
  const scores = diffByKey(
    wanted.memorabilityScores,
    held.memorabilityScores,
    scoreKey,
    { remove: false },
  );
  scores.delete = held.memorabilityScores.filter((row) =>
    retired.includes(row.match),
  );
  return {
    competitions: diffByKey(wanted.competitions, held.competitions, bySlug, {
      remove: false,
    }),
    seasons: diffByKey(
      wanted.seasons,
      held.seasons,
      (row) => `${row.competition}|${row.label}`,
      { remove: false },
    ),
    clubs: diffByKey(wanted.clubs, held.clubs, bySlug, { remove: false }),
    clubAliases: diffByKey(
      wanted.clubAliases,
      held.clubAliases,
      (row) => `${row.club}|${row.alias}`,
      { remove: true },
    ),
    players: diffByKey(wanted.players, held.players, bySlug, { remove: false }),
    playerAliases: diffByKey(
      wanted.playerAliases,
      held.playerAliases,
      (row) => `${row.player}|${row.normalized}`,
      { remove: true },
    ),
    matches: diffByKey(wanted.matches, held.matches, bySlug, { remove: false }),
    matchTeams: diffByKey(
      wanted.matchTeams,
      held.matchTeams,
      (row) => `${row.match}|${row.side}`,
      { remove: false },
    ),
    lineups: lineups.plan,
    matchEvents: events.plan,
    memorabilityScores: scores,
    rewrittenSides: lineups.rewritten.toSorted(),
    replacedEvents: events.rewritten.toSorted(),
    retired,
    played,
  };
}
