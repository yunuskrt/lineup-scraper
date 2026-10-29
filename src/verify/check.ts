import { z } from 'zod';
import { SQUAD_SIZE } from '@/dataset/constants.js';
import type { CompetitionKind, PositionGroup, Side } from '@/dataset/enums.js';
import { positionForSlot } from '@/dataset/formation.js';
import { sideSignalsBlockSchema } from '@/dataset/side-signals.js';
import { normalizeName } from '@/names/normalize.js';
import { thresholdFor } from '@/score/pool-rules.js';

export const countsSchema = z.object({
  aliases: z.number(),
  clubs: z.number(),
  competitions: z.number(),
  crests: z.number(),
  events: z.number(),
  lineups: z.number(),
  matches: z.number(),
  photos: z.number(),
  players: z.number(),
});

export type Counts = z.infer<typeof countsSchema>;

export interface StoredLineup {
  slot: number;
  position: PositionGroup;
  aliasCount: number;
}

export interface StoredTeam {
  side: Side;
  formation: string | null;
  lineups: StoredLineup[];
}

export interface StoredMatch {
  slug: string;
  kind: CompetitionKind;
  score: number | null;
  signals: unknown;
  teams: StoredTeam[];
  events: number;
}

export interface StoredPlayer {
  slug: string;
  imageKey: string | null;
  aliases: { alias: string; normalized: string }[];
}

export interface StoredClub {
  slug: string;
  crestKey: string | null;
}

// What the database holds for the dataset's slugs
export interface VerifyState {
  competitions: string[];
  clubs: StoredClub[];
  players: StoredPlayer[];
  matches: StoredMatch[];
}

export interface Expected {
  competitions: string[];
  clubs: string[];
  players: string[];
  matches: string[];
  counts: Counts;
}

export interface Failure {
  subject: string;
  rule: string;
}

// data-contract.md § 9.3, for one side
function checkTeam(team: StoredTeam): string[] {
  const { side, formation, lineups } = team;
  if (formation === null) return [`${side}: no formation`];
  const rules: string[] = [];
  if (lineups.length !== SQUAD_SIZE) {
    rules.push(`${side}: ${lineups.length} starters, not ${SQUAD_SIZE}`);
  }
  for (const lineup of lineups.toSorted((a, b) => a.slot - b.slot)) {
    if (lineup.position !== positionForSlot(formation, lineup.slot)) {
      rules.push(`${side}: slot ${lineup.slot} has the wrong position`);
    }
    if (lineup.aliasCount === 0) {
      rules.push(`${side}: slot ${lineup.slot} has no alias`);
    }
  }
  return rules;
}

// § 9.1 served, § 9.2 complete, § 9.3 playable
export function checkMatch(match: StoredMatch): string[] {
  const rules: string[] = [];
  if (match.score === null) rules.push('no memorability score');
  else if (match.score < thresholdFor(match.kind)) {
    rules.push(`score below ${thresholdFor(match.kind)}`);
  }
  if (!sideSignalsBlockSchema.safeParse(match.signals).success) {
    rules.push('invalid sides block');
  }
  const sides = match.teams.map((team) => team.side).toSorted();
  if (sides.join() !== 'away,home') rules.push('not one home and one away');
  for (const team of match.teams) rules.push(...checkTeam(team));
  return rules;
}

function checkPlayer(player: StoredPlayer): string[] {
  if (player.aliases.length === 0) return ['no alias'];
  const off = player.aliases.filter(
    (a) => a.normalized !== normalizeName(a.alias),
  ).length;
  return off > 0 ? [`${off} aliases not normalizeName(alias)`] : [];
}

function countsOf(state: VerifyState, expected: Expected): Counts {
  const wanted = new Set(expected.matches);
  const matches = state.matches.filter((m) => wanted.has(m.slug));
  return {
    aliases: state.players.reduce((n, p) => n + p.aliases.length, 0),
    clubs: state.clubs.length,
    competitions: state.competitions.length,
    crests: state.clubs.filter((c) => c.crestKey !== null).length,
    events: matches.reduce((n, m) => n + m.events, 0),
    lineups: matches.reduce(
      (n, m) => n + m.teams.reduce((k, t) => k + t.lineups.length, 0),
      0,
    ),
    matches: matches.length,
    photos: state.players.filter((p) => p.imageKey !== null).length,
    players: state.players.length,
  };
}

function missing(kind: string, wanted: string[], found: string[]): Failure[] {
  const have = new Set(found);
  return wanted
    .filter((slug) => !have.has(slug))
    .map((slug) => ({
      subject: `${kind} ${slug}`,
      rule: 'not in the database',
    }));
}

// Every failure, by subject; never a value
export function verifyState(state: VerifyState, expected: Expected): Failure[] {
  const failures: Failure[] = [
    ...missing('competition', expected.competitions, state.competitions),
    ...missing(
      'club',
      expected.clubs,
      state.clubs.map((c) => c.slug),
    ),
    ...missing(
      'player',
      expected.players,
      state.players.map((p) => p.slug),
    ),
    ...missing(
      'match',
      expected.matches,
      state.matches.map((m) => m.slug),
    ),
  ];
  const wanted = new Set(expected.matches);
  for (const match of state.matches) {
    if (!wanted.has(match.slug)) {
      failures.push({
        subject: `match ${match.slug}`,
        rule: 'served but not in the dataset',
      });
    }
    for (const rule of checkMatch(match)) {
      failures.push({ subject: `match ${match.slug}`, rule });
    }
  }
  for (const player of state.players) {
    for (const rule of checkPlayer(player)) {
      failures.push({ subject: `player ${player.slug}`, rule });
    }
  }
  const counts = countsOf(state, expected);
  for (const key of Object.keys(counts) as (keyof Counts)[]) {
    if (counts[key] !== expected.counts[key]) {
      failures.push({
        subject: `count ${key}`,
        rule: `database ${counts[key]}, manifest ${expected.counts[key]}`,
      });
    }
  }
  return failures;
}

// Each stored key, for the bucket check
export function storedImageKeys(state: VerifyState): string[] {
  return [
    ...state.clubs.flatMap((c) => (c.crestKey ? [c.crestKey] : [])),
    ...state.players.flatMap((p) => (p.imageKey ? [p.imageKey] : [])),
  ].toSorted();
}
