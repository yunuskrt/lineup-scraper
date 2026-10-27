import { SQUAD_SIZE } from '@/dataset/constants.js';
import type { CompetitionKind, Side } from '@/dataset/enums.js';
import { eraBucket, thresholdFor } from '@/score/pool-rules.js';
import {
  dramaParts,
  dramaSignal,
  rivalrySignal,
  sideStarPower,
  stageSignal,
  type DramaParts,
  type MatchFacts,
} from '@/score/signals.js';

// Bump on any change to a weight, signal or floor
export const ALGORITHM_VERSION = 's10-v1';

const WEIGHTS = { stage: 0.3, rivalry: 0.15, drama: 0.35, starPower: 0.2 };
// So a small threshold retune drops none
const FLOOR_MARGIN = 5;
const SIDES: readonly Side[] = ['home', 'away'];

export interface ScoreInput extends MatchFacts {
  slug: string;
  kind: CompetitionKind;
  seasonStart: number;
  stage: string | null;
  groups: string[];
  starters: Record<Side, string[]>;
}

// Alphabetical keys: the file's key order
export interface Signals {
  drama: number;
  eraBucket: number;
  percentile: number;
  raw: DramaParts;
  rawScore: number;
  rivalry: number;
  sides: { away: { starPower: number }; home: { starPower: number } };
  stage: number;
  starPower: number;
}

export interface MatchScore {
  algorithmVersion: string;
  computedAt: string;
  score: number;
  signals: Signals;
  slug: string;
}

export interface MissingPage {
  slug: string;
  side: Side;
  player: string;
}

export interface Scores {
  scores: MatchScore[];
  missing: MissingPage[];
  // Sides with fewer than 11 starters: unmapped
  short: { slug: string; side: Side }[];
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function floorFor(kind: CompetitionKind): number {
  return thresholdFor(kind) + FLOOR_MARGIN;
}

// Rank from 0 to 1, ties sharing their mean rank
export function percentiles(values: readonly number[]): number[] {
  if (values.length === 1) return [0.5];
  const sorted = values.toSorted((a, b) => a - b);
  return values.map((value) => {
    const first = sorted.indexOf(value);
    const last = sorted.lastIndexOf(value);
    return (first + last) / 2 / (values.length - 1);
  });
}

function signalsOf(
  input: ScoreInput,
  caps: ReadonlyMap<string, number>,
): Omit<Signals, 'percentile'> {
  const bucket = eraBucket(input.seasonStart);
  if (bucket === null) {
    throw new Error(`${input.slug}: season outside the era buckets`);
  }
  const raw = dramaParts(input);
  const home = round(sideStarPower(input.starters.home, caps), 4);
  const away = round(sideStarPower(input.starters.away, caps), 4);
  const parts = {
    drama: round(dramaSignal(raw), 4),
    rivalry: rivalrySignal(input.groups),
    stage: stageSignal(input.stage),
    starPower: round((home + away) / 2, 4),
  };
  const rawScore =
    WEIGHTS.stage * parts.stage +
    WEIGHTS.rivalry * parts.rivalry +
    WEIGHTS.drama * parts.drama +
    WEIGHTS.starPower * parts.starPower;
  return {
    drama: parts.drama,
    eraBucket: bucket,
    raw,
    rawScore: round(rawScore, 4),
    rivalry: parts.rivalry,
    sides: { away: { starPower: away }, home: { starPower: home } },
    stage: parts.stage,
    starPower: parts.starPower,
  };
}

export function scoreMatches(
  inputs: readonly ScoreInput[],
  caps: ReadonlyMap<string, number>,
  computedAt: string,
): Scores {
  const signals = inputs.map((input) => signalsOf(input, caps));
  const percentile = new Map<number, number>();
  for (const bucket of new Set(signals.map((s) => s.eraBucket))) {
    const members = [...signals.keys()].filter(
      (i) => signals[i].eraBucket === bucket,
    );
    const ranks = percentiles(members.map((i) => signals[i].rawScore));
    members.forEach((i, at) => percentile.set(i, ranks[at]));
  }
  const scores = inputs.map((input, i): MatchScore => {
    const p = round(percentile.get(i) ?? 0.5, 4);
    const floor = floorFor(input.kind);
    const { raw, rawScore, rivalry, sides, stage, starPower, drama } =
      signals[i];
    return {
      algorithmVersion: ALGORITHM_VERSION,
      computedAt,
      score: round(floor + (100 - floor) * p, 2),
      signals: {
        drama,
        eraBucket: signals[i].eraBucket,
        percentile: p,
        raw,
        rawScore,
        rivalry,
        sides,
        stage,
        starPower,
      },
      slug: input.slug,
    };
  });
  const missing = inputs.flatMap((input) =>
    SIDES.flatMap((side) =>
      input.starters[side]
        .filter((id) => !caps.has(id))
        .map((player) => ({ slug: input.slug, side, player })),
    ),
  );
  const short = inputs.flatMap((input) =>
    SIDES.filter((side) => input.starters[side].length < SQUAD_SIZE).map(
      (side) => ({ slug: input.slug, side }),
    ),
  );
  return {
    scores: scores.toSorted((a, b) =>
      a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0,
    ),
    missing,
    short,
  };
}
