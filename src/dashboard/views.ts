import type { Entry } from '@/dashboard/blocks.js';
import { coverage, type CoverageCell } from '@/dashboard/coverage.js';
import { failuresOf, type Failure } from '@/dashboard/failures.js';
import { isError, LINK_TYPES, STATUSES } from '@/dashboard/links.js';
import {
  breakdown,
  DIMENSIONS,
  eraLabel,
  progressOf,
  type BreakdownRow,
  type Dimension,
  type TypeProgress,
} from '@/dashboard/progress.js';
import type { Snapshot } from '@/dashboard/read.js';
import { warningsOf, type Warning } from '@/dashboard/warnings.js';
import { ERA_BUCKETS } from '@/score/pool-rules.js';

export const LINKS_PAGE = 100;

export interface Labels {
  competitions: Record<string, string>;
  clubs: Record<string, string>;
}

export interface Overview {
  problems: string[];
  warnings: Warning[];
  totals: TypeProgress[];
  breakdowns: Record<Dimension, BreakdownRow[]>;
  labels: Labels;
}

export interface LinkFilter {
  type?: string;
  // A status, or `error` for any error
  status?: string;
  group?: string;
  competition?: string;
  season?: string;
  q?: string;
  page?: number;
}

export interface LinkView {
  index: number;
  type: string;
  link: string;
  saveAs: string;
  status: string;
  key: string;
  groups: string[];
  competition: string | null;
  season: string | null;
}

export interface LinksView {
  total: number;
  page: number;
  pages: number;
  rows: LinkView[];
  facets: Record<
    'types' | 'statuses' | 'groups' | 'competitions' | 'seasons',
    string[]
  >;
}

export function labelsOf(snapshot: Snapshot): Labels {
  return {
    competitions: Object.fromEntries(
      snapshot.config.competitions.map((c) => [c.code, c.name]),
    ),
    clubs: Object.fromEntries(
      snapshot.config.clubs.flatMap((c) => (c.id ? [[c.id, c.name]] : [])),
    ),
  };
}

function curatedIds(snapshot: Snapshot): Set<string> {
  return new Set(snapshot.config.clubs.flatMap((c) => (c.id ? [c.id] : [])));
}

export function overview(snapshot: Snapshot): Overview {
  const { entries } = snapshot;
  const curated = curatedIds(snapshot);
  const breakdowns = Object.fromEntries(
    DIMENSIONS.map((d) => [d, breakdown(entries, d, curated)]),
  ) as Record<Dimension, BreakdownRow[]>;
  return {
    problems: snapshot.problems,
    warnings: warningsOf({
      entries,
      inbox: snapshot.inbox.length,
      csvAt: snapshot.csvAt,
      sourcesAt: snapshot.sourcesAt,
    }),
    totals: progressOf(entries),
    breakdowns,
    labels: labelsOf(snapshot),
  };
}

function isKept(entry: Entry, filter: LinkFilter): boolean {
  const { context } = entry;
  const q = filter.q?.trim().toLowerCase();
  return (
    (!filter.type || entry.type === filter.type) &&
    (!filter.status ||
      (filter.status === 'error'
        ? isError(entry.status)
        : entry.status === filter.status)) &&
    (!filter.group || context.groups.includes(filter.group)) &&
    (!filter.competition || context.competition === filter.competition) &&
    (!filter.season || context.season === filter.season) &&
    (!q ||
      entry.key.toLowerCase().includes(q) ||
      entry.saveAs.toLowerCase().includes(q))
  );
}

function distinct(values: Iterable<string | null>): string[] {
  const set = new Set<string>();
  for (const value of values) if (value !== null) set.add(value);
  return [...set].toSorted();
}

export function linksView(
  entries: readonly Entry[],
  filter: LinkFilter = {},
): LinksView {
  const kept = entries.filter((e) => isKept(e, filter));
  const pages = Math.max(1, Math.ceil(kept.length / LINKS_PAGE));
  const page = Math.min(Math.max(1, filter.page ?? 1), pages);
  return {
    total: kept.length,
    page,
    pages,
    rows: kept
      .slice((page - 1) * LINKS_PAGE, page * LINKS_PAGE)
      .map(({ context, ...row }) => ({
        index: row.index,
        type: row.type,
        link: row.link,
        saveAs: row.saveAs,
        status: row.status,
        key: row.key,
        groups: context.groups,
        competition: context.competition,
        season: context.season,
      })),
    facets: {
      types: [...LINK_TYPES],
      statuses: [...STATUSES, 'error'],
      groups: distinct(entries.flatMap((e) => e.context.groups)),
      competitions: distinct(entries.map((e) => e.context.competition)),
      seasons: distinct(entries.map((e) => e.context.season)),
    },
  };
}

export interface CoverageView {
  cells: CoverageCell[];
  eras: string[];
  labels: Labels;
}

export function coverageView(snapshot: Snapshot): CoverageView {
  const ingested = new Set(
    snapshot.entries
      .filter((e) => e.type === 'Match Report' && e.status === 'ingested')
      .map((e) => e.key),
  );
  return {
    cells: coverage(snapshot.config, snapshot.matches, ingested),
    eras: ERA_BUCKETS.map((_, i) => eraLabel(i)),
    labels: labelsOf(snapshot),
  };
}

export function failuresView(snapshot: Snapshot): Failure[] {
  return failuresOf({
    entries: snapshot.entries,
    log: snapshot.log,
    inbox: snapshot.inbox,
    notes: [...snapshot.problems, ...snapshot.notes],
  });
}
