import { SQUAD_SIZE } from '@/dataset/constants.js';
import type { Side } from '@/dataset/enums.js';
import type { LineupEvent } from '@/lineups/events.js';
import type { Score } from '@/lineups/score.js';

const STAGE_WEIGHTS: Record<string, number> = {
  Final: 1,
  'Semi-final': 0.8,
  'Quarter-final': 0.6,
  'Round of 16': 0.5,
  'Third-place play-off': 0.4,
};
const GROUP_STAGE = 0.3;
const LEAGUE_STAGE = 0.2;

// Tuned in S10; bump the algorithm version
const DRAMA_WEIGHTS = {
  goals: 0.25,
  comebackFromHt: 0.2,
  extraTime: 0.1,
  shootout: 0.15,
  lateWinner: 0.15,
  redCards: 0.1,
  hatTrick: 0.05,
} as const;

const GOAL_KINDS = new Set(['goal', 'own_goal', 'penalty_goal']);
const LATE_MINUTE = 90;
const CAPS_CAP = 100;

// Alphabetical keys: the file's key order
export interface DramaParts {
  comebackFromHt: boolean;
  extraTime: boolean;
  goals: number;
  hatTrick: boolean;
  lateWinner: boolean;
  redCards: number;
  shootout: boolean;
}

export interface MatchFacts {
  goals: Score;
  halfTime: Score | null;
  extraTime: boolean;
  shootout: Score | null;
  events: LineupEvent[];
}

export function stageSignal(stage: string | null): number {
  if (stage === null) return LEAGUE_STAGE;
  if (stage in STAGE_WEIGHTS) return STAGE_WEIGHTS[stage];
  return stage.startsWith('Group ') ? GROUP_STAGE : LEAGUE_STAGE;
}

export function rivalrySignal(groups: readonly string[]): number {
  if (groups.includes('derbies')) return 1;
  return groups.includes('clashes') ? 0.5 : 0;
}

function leader(score: Score): Side | null {
  if (score.home === score.away) return null;
  return score.home > score.away ? 'home' : 'away';
}

// The side behind at half time didn't lose
function isComeback(facts: MatchFacts): boolean {
  const ahead = facts.halfTime ? leader(facts.halfTime) : null;
  return ahead !== null && leader(facts.goals) !== ahead;
}

// The goal that put the winner ahead for good
function isLateWinner(facts: MatchFacts): boolean {
  const winner = leader(facts.goals);
  const goals = facts.events.filter(
    (e) => GOAL_KINDS.has(e.kind) && e.minute !== null,
  );
  const total = facts.goals.home + facts.goals.away;
  if (winner === null || goals.length !== total) return false;
  const running: Score = { home: 0, away: 0 };
  let decisive: number | null = null;
  for (const goal of goals) {
    const wasAhead = leader(running) === winner;
    running[goal.side] += 1;
    if (!wasAhead && leader(running) === winner) decisive = goal.minute;
  }
  return decisive !== null && decisive >= LATE_MINUTE;
}

function hasHatTrick(events: LineupEvent[]): boolean {
  const scored = new Map<string, number>();
  for (const e of events) {
    if ((e.kind === 'goal' || e.kind === 'penalty_goal') && e.player) {
      scored.set(e.player, (scored.get(e.player) ?? 0) + 1);
    }
  }
  return [...scored.values()].some((count) => count >= 3);
}

export function dramaParts(facts: MatchFacts): DramaParts {
  return {
    comebackFromHt: isComeback(facts),
    extraTime: facts.extraTime,
    goals: facts.goals.home + facts.goals.away,
    hatTrick: hasHatTrick(facts.events),
    lateWinner: isLateWinner(facts),
    redCards: facts.events.filter((e) => e.kind === 'red_card').length,
    shootout: facts.shootout !== null,
  };
}

export function dramaSignal(parts: DramaParts): number {
  const flag = (value: boolean): number => (value ? 1 : 0);
  const w = DRAMA_WEIGHTS;
  return (
    w.goals * (Math.min(parts.goals, 6) / 6) +
    w.comebackFromHt * flag(parts.comebackFromHt) +
    w.extraTime * flag(parts.extraTime) +
    w.shootout * flag(parts.shootout) +
    w.lateWinner * flag(parts.lateWinner) +
    w.redCards * (Math.min(parts.redCards, 2) / 2) +
    w.hatTrick * flag(parts.hatTrick)
  );
}

// `86 / 0` → 86; no caps line → 0
export function readCaps(capsGoals: string | null): number {
  const caps = /^([0-9]+)\s*\//.exec(capsGoals ?? '')?.[1];
  return caps === undefined ? 0 : Number(caps);
}

// The XI's mean capped caps; no page is 0
export function sideStarPower(
  starters: readonly string[],
  caps: ReadonlyMap<string, number>,
): number {
  const total = starters.reduce(
    (sum, id) => sum + Math.min(caps.get(id) ?? 0, CAPS_CAP) / CAPS_CAP,
    0,
  );
  return total / SQUAD_SIZE;
}
