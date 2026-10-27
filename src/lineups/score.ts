import type { Side } from '@/dataset/enums.js';
import type { LineupEvent } from '@/lineups/events.js';
import type { TransfermarktMatch } from '@/raw/transfermarkt-match.js';

type RawEvent = TransfermarktMatch['events'][number];

const SCORE = /([0-9]+):([0-9]+)/;
const HALF_TIME_NOTE = /^\(\s*([0-9]+):([0-9]+)\s*\)$/;
const ON_PENS = /\bon pens\b/i;
const AFTER_EXTRA_TIME = /\bAET\b|\ba\.e\.t\./i;
const GOAL_KINDS = new Set(['goal', 'own_goal', 'penalty_goal']);
const KICK_OUTCOMES = new Set(['Scored', 'Missed', 'Saved']);

export interface Score {
  away: number;
  home: number;
}

export function readScore(text: string): Score | null {
  const match = SCORE.exec(text);
  return match ? { away: Number(match[2]), home: Number(match[1]) } : null;
}

export type GoalCount =
  | { isCounted: true; score: Score; sides: Side[] }
  | { isCounted: false; reason: string };

// Each goal raises one side's running score by one
export function countGoals(goals: RawEvent[]): GoalCount {
  let score: Score = { away: 0, home: 0 };
  const sides: Side[] = [];
  for (const goal of goals) {
    const next = readScore(goal.text);
    if (next === null) {
      return { isCounted: false, reason: 'a goal has no running score' };
    }
    const home = next.home - score.home;
    const away = next.away - score.away;
    if (home === 1 && away === 0) sides.push('home');
    else if (home === 0 && away === 1) sides.push('away');
    else return { isCounted: false, reason: 'the running score jumps' };
    score = next;
  }
  return { isCounted: true, score, sides };
}

// Keys in alphabetical order: the file's key order
export interface MatchScore {
  extraTime: boolean;
  goals: Score;
  halfTime: Score | null;
  shootout: Score | null;
}

export type ScoreRead =
  ({ isRead: true } & MatchScore) | { isRead: false; reason: string };

function isSame(a: Score, b: Score): boolean {
  return a.home === b.home && a.away === b.away;
}

// From the note, else goals up to 45+; unknown minutes give null
export function halfTime(
  note: string | null,
  events: LineupEvent[],
): Score | null {
  const fromNote = note === null ? null : HALF_TIME_NOTE.exec(note.trim());
  if (fromNote) return { away: Number(fromNote[2]), home: Number(fromNote[1]) };
  const goals = events.filter((e) => GOAL_KINDS.has(e.kind));
  if (goals.some((e) => e.minute === null)) return null;
  const firstHalf = goals.filter((e) => e.minute! <= 45);
  return {
    away: firstHalf.filter((e) => e.side === 'away').length,
    home: firstHalf.filter((e) => e.side === 'home').length,
  };
}

// The shootout is counted from its kicks, never the box
export function readMatchScore(
  report: TransfermarktMatch,
  goals: Score,
  events: LineupEvent[],
): ScoreRead {
  const note = report.resultNote;
  const isOnPens = note !== null && ON_PENS.test(note);
  const isAfterExtraTime = note !== null && AFTER_EXTRA_TIME.test(note);
  const isHalfTime = note !== null && HALF_TIME_NOTE.test(note.trim());
  if (note !== null && !isOnPens && !isAfterExtraTime && !isHalfTime) {
    return { isRead: false, reason: 'unknown result note' };
  }
  const shown = readScore(report.result);
  if (shown === null) return { isRead: false, reason: 'no score shown' };
  const shootout = countKicks(report.shootout);
  if (typeof shootout === 'string') return { isRead: false, reason: shootout };
  const problem = isOnPens
    ? shootoutProblem(shown, goals, shootout)
    : plainProblem(shown, goals, shootout);
  if (problem !== null) return { isRead: false, reason: problem };
  return {
    isRead: true,
    extraTime: isOnPens || isAfterExtraTime,
    goals,
    halfTime: halfTime(isOnPens || isAfterExtraTime ? null : note, events),
    shootout,
  };
}

// Scored kicks per side; null without a shootout
export function countKicks(
  kicks: TransfermarktMatch['shootout'],
): Score | null | string {
  if (kicks.length === 0) return null;
  if (kicks.some((k) => !KICK_OUTCOMES.has(k.outcome))) {
    return 'unknown shootout kick';
  }
  const scored = (side: Side) =>
    kicks.filter((k) => k.side === side && k.outcome === 'Scored').length;
  return { away: scored('away'), home: scored('home') };
}

function plainProblem(
  shown: Score,
  goals: Score,
  shootout: Score | null,
): string | null {
  if (shootout !== null) return 'shootout kicks without `on pens`';
  return isSame(shown, goals) ? null : 'the shown score differs from the goals';
}

// The box shows the shootout, or the score plus it
function shootoutProblem(
  shown: Score,
  goals: Score,
  shootout: Score | null,
): string | null {
  if (shootout === null) return 'no shootout kicks on the page';
  if (shootout.home === shootout.away) return 'the shootout is a draw';
  const sum = {
    away: goals.away + shootout.away,
    home: goals.home + shootout.home,
  };
  return isSame(shown, shootout) || isSame(shown, sum)
    ? null
    : 'the shown score fits neither the shootout nor the score plus it';
}
