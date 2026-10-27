import { areNeighbours } from '@/aliases/similarity.js';
import { SQUAD_SIZE } from '@/dataset/constants.js';
import type { PositionGroup, Side } from '@/dataset/enums.js';
import { formationSchema, positionForSlot } from '@/dataset/formation.js';
import { sideSignalsBlockSchema } from '@/dataset/side-signals.js';
import { normalizeName } from '@/names/normalize.js';

const SIDES: readonly Side[] = ['home', 'away'];

export interface GateStarter {
  position: PositionGroup;
  slot: number;
  transfermarktId: string;
}

export interface GateSide {
  formation: string | null;
  starters: GateStarter[];
}

export interface GateMatch {
  slug: string;
  sides: Record<Side, GateSide>;
  starPower: Record<Side, number>;
}

// What the gate knows of each spieler id
export interface GatePlayers {
  slugs: ReadonlyMap<string, string>;
  aliases: ReadonlyMap<string, readonly string[]>;
}

export interface Failure {
  // `away slot 7`, `home`, or the match
  at: string;
  rule: string;
}

export interface SideSignals {
  guessability: number;
  starPower: number;
}

// Alphabetical keys: the file's key order
export interface GateResult {
  failures: Failure[];
  passed: boolean;
  sides: { away: SideSignals; home: SideSignals };
  slug: string;
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function shapeFailures(side: Side, team: GateSide): Failure[] {
  const failures: Failure[] = [];
  const fail = (rule: string): void => {
    failures.push({ at: side, rule });
  };
  if (team.formation === null) fail('no formation');
  else if (!formationSchema.safeParse(team.formation).success) {
    fail('formation breaks the schema');
  }
  const { starters } = team;
  if (starters.length !== SQUAD_SIZE) fail(`${starters.length} starters`);
  const slots = new Set(starters.map((s) => s.slot));
  const inRange = starters.every(
    (s) => Number.isInteger(s.slot) && s.slot >= 0 && s.slot < SQUAD_SIZE,
  );
  if (slots.size !== starters.length || !inRange) {
    fail('slots are not 0–10 once each');
  }
  const players = new Set(starters.map((s) => s.transfermarktId));
  if (players.size !== starters.length) fail('a player starts twice');
  return failures;
}

// Normalised aliases per starter, by slot order
function aliasesBySlot(
  team: GateSide,
  players: GatePlayers,
): { starter: GateStarter; aliases: string[] }[] {
  return team.starters
    .toSorted((a, b) => a.slot - b.slot)
    .map((starter) => ({
      starter,
      aliases: [...(players.aliases.get(starter.transfermarktId) ?? [])].map(
        normalizeName,
      ),
    }));
}

// 1: a clean own alias; 0.5: all have neighbours
function starterGuessability(own: string[], others: string[]): number {
  if (own.length === 0) return 0;
  const isClean = (alias: string): boolean =>
    others.every((other) => !areNeighbours(alias, other));
  return own.some(isClean) ? 1 : 0.5;
}

function checkSide(
  side: Side,
  team: GateSide,
  players: GatePlayers,
): { failures: Failure[]; guessability: number } {
  const failures = shapeFailures(side, team);
  const entries = aliasesBySlot(team, players);
  let total = 0;
  for (const { starter, aliases } of entries) {
    const at = `${side} slot ${starter.slot}`;
    const fail = (rule: string): void => {
      failures.push({ at, rule });
    };
    const expected = team.formation
      ? positionForSlot(team.formation, starter.slot)
      : null;
    if (team.formation && expected !== starter.position) {
      fail(`breaks ${team.formation}`);
    }
    if (!players.slugs.has(starter.transfermarktId)) fail('no player');
    if (aliases.length === 0) {
      fail('no alias');
      continue;
    }
    const others = entries
      .filter((e) => e.starter !== starter)
      .flatMap((e) => e.aliases);
    const own = aliases.filter((alias) => !others.includes(alias));
    if (own.length === 0) fail('no alias of their own');
    total += starterGuessability(own, others);
  }
  return { failures, guessability: round(total / SQUAD_SIZE) };
}

export function gateMatch(match: GateMatch, players: GatePlayers): GateResult {
  const checked = {
    home: checkSide('home', match.sides.home, players),
    away: checkSide('away', match.sides.away, players),
  };
  const failures = SIDES.flatMap((side) => checked[side].failures);
  const homeIds = new Set(
    match.sides.home.starters.map((s) => s.transfermarktId),
  );
  if (match.sides.away.starters.some((s) => homeIds.has(s.transfermarktId))) {
    failures.push({ at: 'match', rule: 'a player starts for both sides' });
  }
  const sides = {
    away: {
      guessability: checked.away.guessability,
      starPower: match.starPower.away,
    },
    home: {
      guessability: checked.home.guessability,
      starPower: match.starPower.home,
    },
  };
  // The backend turns a bad block neutral, silently
  if (!sideSignalsBlockSchema.safeParse({ sides }).success) {
    throw new Error(`${match.slug}: sides block fails the backend schema`);
  }
  return { failures, passed: failures.length === 0, sides, slug: match.slug };
}

export function failureText(failure: Failure): string {
  return `${failure.at}: ${failure.rule}`;
}

export function gateMatches(
  matches: readonly GateMatch[],
  players: GatePlayers,
): GateResult[] {
  return matches
    .map((match) => gateMatch(match, players))
    .toSorted((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}
