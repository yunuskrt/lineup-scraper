import type { Entry } from '@/dashboard/blocks.js';
import { isError, LINK_TYPES, type LinkType } from '@/dashboard/links.js';
import { poolGroupSchema } from '@/pool/config.js';
import { ERA_BUCKETS } from '@/score/pool-rules.js';

export const LADDERS: Record<LinkType, readonly string[]> = {
  Fixture: ['saved', 'parsed'],
  'Match Report': ['saved', 'parsed', 'validated', 'ingested'],
  Player: ['saved', 'parsed', 'validated', 'ingested'],
  Crest: ['saved', 'uploaded', 'ingested'],
  PlayerPhoto: ['saved', 'uploaded', 'ingested'],
};

export const DIMENSIONS = [
  'group',
  'competition',
  'season',
  'era',
  'club',
] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export interface StepCount {
  step: string;
  count: number;
}

export interface TypeProgress {
  type: LinkType;
  total: number;
  errors: number;
  steps: StepCount[];
}

export interface BreakdownRow {
  key: string;
  types: TypeProgress[];
}

// 0 for `to save`, -1 for an error
export function rank(type: LinkType, status: string): number {
  if (isError(status)) return -1;
  return LADDERS[type].indexOf(status) + 1;
}

export function eraLabel(era: number): string {
  const bucket = ERA_BUCKETS[era];
  if (!bucket) return String(era);
  return `${bucket.from}–${String(bucket.to).slice(2)}`;
}

// Cumulative: parsed counts validated and ingested
export function progressOf(entries: readonly Entry[]): TypeProgress[] {
  return LINK_TYPES.flatMap((type) => {
    const mine = entries.filter((e) => e.type === type);
    if (mine.length === 0) return [];
    const ranks = mine.map((e) => rank(type, e.status));
    return [
      {
        type,
        total: mine.length,
        errors: ranks.filter((r) => r === -1).length,
        steps: LADDERS[type].map((step, i) => ({
          step,
          count: ranks.filter((r) => r > i).length,
        })),
      },
    ];
  });
}

function keysOf(
  entry: Entry,
  dimension: Dimension,
  curated: ReadonlySet<string>,
): string[] {
  const { context } = entry;
  switch (dimension) {
    case 'group':
      return context.groups;
    case 'competition':
      return context.competition === null ? [] : [context.competition];
    case 'season':
      return context.season === null ? [] : [context.season];
    case 'era':
      return context.era === null ? [] : [eraLabel(context.era)];
    case 'club':
      return context.clubs.filter((id) => curated.has(id));
  }
}

const GROUP_ORDER: readonly string[] = poolGroupSchema.options;

function compareKeys(dimension: Dimension, a: string, b: string): number {
  if (dimension === 'group') {
    const order = (key: string) => {
      const at = GROUP_ORDER.indexOf(key);
      return at === -1 ? GROUP_ORDER.length : at;
    };
    return order(a) - order(b) || a.localeCompare(b);
  }
  return a.localeCompare(b);
}

// Once per key; a match under both its clubs
export function breakdown(
  entries: readonly Entry[],
  dimension: Dimension,
  curated: ReadonlySet<string> = new Set(),
): BreakdownRow[] {
  const groups = new Map<string, Entry[]>();
  for (const entry of entries) {
    for (const key of new Set(keysOf(entry, dimension, curated))) {
      const list = groups.get(key) ?? [];
      list.push(entry);
      groups.set(key, list);
    }
  }
  return [...groups.keys()]
    .toSorted((a, b) => compareKeys(dimension, a, b))
    .map((key) => ({ key, types: progressOf(groups.get(key) ?? []) }));
}
