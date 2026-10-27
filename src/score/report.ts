import type { CompetitionKind } from '@/dataset/enums.js';
import { ERA_BUCKETS, thresholdFor } from '@/score/pool-rules.js';
import type { Scores } from '@/score/score.js';

// Below this, a bucket's percentiles still swing
const SMALL_BUCKET = 10;

export interface ScoredMatch {
  slug: string;
  kind: CompetitionKind;
  groups: string[];
}

function section(title: string, lines: string[]): string[] {
  return lines.length === 0
    ? []
    : [`## ${title}`, '', ...lines.map((l) => `- ${l}`), ''];
}

function median(sorted: number[]): number {
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function spread(
  name: string,
  values: number[],
  thresholds: Set<number>,
): string {
  const sorted = values.toSorted((a, b) => a - b);
  const low = sorted[0].toFixed(2);
  const high = sorted[sorted.length - 1].toFixed(2);
  const clear = [...thresholds].toSorted((a, b) => a - b).join(' or ');
  return (
    `\`${name}\`: ${values.length}, lowest ${low}, median ${median(sorted).toFixed(2)}, ` +
    `highest ${high}; must clear ${clear}`
  );
}

function grouped(
  matches: ScoredMatch[],
  scoreOf: Map<string, number>,
  keys: (m: ScoredMatch) => string[],
): string[] {
  const values = new Map<string, number[]>();
  const thresholds = new Map<string, Set<number>>();
  for (const match of matches) {
    for (const key of keys(match)) {
      values.set(key, [...(values.get(key) ?? []), scoreOf.get(match.slug)!]);
      thresholds.set(
        key,
        (thresholds.get(key) ?? new Set()).add(thresholdFor(match.kind)),
      );
    }
  }
  return [...values.keys()]
    .toSorted()
    .map((key) => spread(key, values.get(key)!, thresholds.get(key)!));
}

// Local only: never shown to players (HC 20)
export function renderReport(matches: ScoredMatch[], result: Scores): string {
  const scoreOf = new Map(result.scores.map((s) => [s.slug, s.score]));
  const below = result.scores.filter(
    (s) => s.score < thresholdFor(matches.find((m) => m.slug === s.slug)!.kind),
  );
  const buckets = ERA_BUCKETS.map((bucket, index) => {
    const count = result.scores.filter(
      (s) => s.signals.eraBucket === index,
    ).length;
    const small =
      count > 0 && count < SMALL_BUCKET
        ? ' (small: scores move as it grows)'
        : '';
    return `${bucket.from}–${bucket.to}: ${count}${small}`;
  });
  const lines = [
    '# Scores',
    '',
    `Matches scored: ${result.scores.length}. Below their threshold: ${below.length}. ` +
      `Starters without a player page (0 caps): ${result.missing.length}.`,
    '',
    ...section(
      'By group',
      grouped(matches, scoreOf, (m) => m.groups),
    ),
    ...section(
      'By competition kind',
      grouped(matches, scoreOf, (m) => [m.kind]),
    ),
    ...section('By era bucket', buckets),
    ...section(
      'Below their threshold (retune the backend first)',
      below.map((s) => `\`${s.slug}\`: ${s.score.toFixed(2)}`),
    ),
    ...section(
      'Sides with no XI (star power 0; S13 drops the match)',
      result.short.map((s) => `\`${s.slug}\` ${s.side}`),
    ),
    ...section(
      'Starters without a player page',
      result.missing.map((m) => `\`${m.slug}\` ${m.side}: spieler ${m.player}`),
    ),
  ];
  return `${lines.join('\n').trimEnd()}\n`;
}
