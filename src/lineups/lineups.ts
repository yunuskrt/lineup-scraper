import type { Side } from '@/dataset/enums.js';
import { readEvents, type LineupEvent } from '@/lineups/events.js';
import {
  formationText,
  toFormation,
  type FormationNames,
} from '@/lineups/formation.js';
import {
  countGoals,
  readMatchScore,
  readScore,
  type Score,
} from '@/lineups/score.js';
import { assignSlots, type Slotted } from '@/lineups/slots.js';
import type { PoolMatch } from '@/pool/build.js';
import type { TransfermarktMatch } from '@/raw/transfermarkt-match.js';
import type { ResolvedMatch } from '@/resolve/resolve.js';

const SIDES: readonly Side[] = ['home', 'away'];

// Keys in alphabetical order: the file's key order
export interface LineupSide {
  club: string;
  formation: string | null;
  goals: number;
  starters: Slotted[];
}

export interface LineupMatch {
  events: LineupEvent[];
  extraTime: boolean;
  halfTime: Score | null;
  shootout: Score | null;
  sides: { away: LineupSide; home: LineupSide };
  slug: string;
  transfermarktId: string;
}

export interface Issue {
  slug: string;
  reason: string;
}

export interface ResultCheck {
  slug: string;
  fixture: string | null;
  goals: Score;
  shootout: Score | null;
}

export interface LineupsInput {
  matches: ResolvedMatch[];
  pool: Map<string, PoolMatch>;
  reports: Map<string, TransfermarktMatch>;
  formationNames: FormationNames;
}

export interface Lineups {
  matches: LineupMatch[];
  waiting: string[];
  held: Issue[];
  sides: Issue[];
  unknownMinutes: Issue[];
  unreadCards: Issue[];
  formations: [string, number][];
  results: ResultCheck[];
}

// The report must describe the listing's match
function disagreement(
  match: ResolvedMatch,
  pool: PoolMatch | undefined,
  report: TransfermarktMatch,
): string | null {
  if (!pool) return 'not in the pool match list';
  if (report.date !== match.date) return 'the date differs from the listing';
  if (
    report.home.sourceId !== pool.home ||
    report.away.sourceId !== pool.away
  ) {
    return 'the teams differ from the listing';
  }
  return null;
}

function lineupSide(
  report: TransfermarktMatch,
  side: Side,
  club: string,
  goals: number,
  names: FormationNames,
): { lineup: LineupSide; issue: string | null } {
  const unmapped = (issue: string) => ({
    lineup: { club, formation: null, goals, starters: [] },
    issue: `${side}: ${issue}`,
  });
  const raw = report[side].formation;
  const formation = toFormation(raw, names);
  if (formation === null) {
    const text = raw === null ? 'none' : `\`${formationText(raw)}\``;
    return unmapped(`formation ${text} not read`);
  }
  const slots = assignSlots(report[side].starters, formation);
  // A formation the XI doesn't fit is not kept
  if (!slots.isMapped) return unmapped(slots.reason);
  return {
    lineup: { club, formation, goals, starters: slots.starters },
    issue: null,
  };
}

function addIssue(into: Issue[], slug: string, reason: string | null): void {
  if (reason !== null) into.push({ slug, reason });
}

export function extractLineups(input: LineupsInput): Lineups {
  const out: Lineups = {
    matches: [],
    waiting: [],
    held: [],
    sides: [],
    unknownMinutes: [],
    unreadCards: [],
    formations: [],
    results: [],
  };
  const formations = new Map<string, number>();
  for (const match of input.matches) {
    const report = input.reports.get(match.transfermarktId);
    if (!report) {
      out.waiting.push(match.slug);
      continue;
    }
    const pool = input.pool.get(match.transfermarktId);
    const goalEvents = report.events.filter((e) => e.box === 'goal');
    const counted = countGoals(goalEvents);
    const problem =
      disagreement(match, pool, report) ??
      (counted.isCounted ? null : counted.reason);
    if (problem !== null || !counted.isCounted) {
      addIssue(out.held, match.slug, problem);
      continue;
    }
    const { events, unreadCards } = readEvents(report, counted.sides);
    const score = readMatchScore(report, counted.score, events);
    if (!score.isRead) {
      addIssue(out.held, match.slug, score.reason);
      continue;
    }
    for (const side of SIDES) {
      const raw = report[side].formation;
      const text = raw === null ? '(none)' : formationText(raw);
      formations.set(text, (formations.get(text) ?? 0) + 1);
    }
    const [home, away] = SIDES.map((side) =>
      lineupSide(
        report,
        side,
        match[side],
        score.goals[side],
        input.formationNames,
      ),
    );
    addIssue(out.sides, match.slug, home!.issue);
    addIssue(out.sides, match.slug, away!.issue);
    const unknown = events.filter((e) => e.minute === null).length;
    if (unknown > 0) {
      addIssue(out.unknownMinutes, match.slug, `${unknown} event(s)`);
    }
    if (unreadCards > 0) {
      addIssue(out.unreadCards, match.slug, `${unreadCards} card(s)`);
    }
    out.results.push({
      slug: match.slug,
      fixture: pool?.result ?? null,
      goals: score.goals,
      shootout: score.shootout,
    });
    out.matches.push({
      events,
      extraTime: score.extraTime,
      halfTime: score.halfTime,
      shootout: score.shootout,
      sides: { away: away!.lineup, home: home!.lineup },
      slug: match.slug,
      transfermarktId: match.transfermarktId,
    });
  }
  out.formations = [...formations].toSorted(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  return out;
}

export type ResultAgreement =
  | 'equal'
  | 'shootout only'
  | 'score plus shootout'
  | 'differs'
  | 'no fixture result';

// How the listing's result relates to the report
export function resultAgreement(check: ResultCheck): ResultAgreement {
  const fixture = check.fixture === null ? null : readScore(check.fixture);
  if (fixture === null) return 'no fixture result';
  const { goals, shootout } = check;
  const isEqual = (a: Score, b: Score) =>
    a.home === b.home && a.away === b.away;
  if (shootout === null) return isEqual(fixture, goals) ? 'equal' : 'differs';
  if (isEqual(fixture, shootout)) return 'shootout only';
  const sum = {
    away: goals.away + shootout.away,
    home: goals.home + shootout.home,
  };
  return isEqual(fixture, sum) ? 'score plus shootout' : 'differs';
}
