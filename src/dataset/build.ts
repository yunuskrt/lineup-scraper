import type {
  ClubKind,
  CompetitionKind,
  MatchEventKind,
  PositionGroup,
  Side,
} from '@/dataset/enums.js';
import type { DatasetInput } from '@/dataset/schema.js';
import type { ResolvedMatch } from '@/resolve/resolve.js';

const SIDES: readonly Side[] = ['home', 'away'];

type Match = DatasetInput['matches'][number];
type Event = Match['events'][number];
type Team = Match['home'];

export interface SourceCompetition {
  slug: string;
  kind: CompetitionKind;
  name: string;
}

export interface SourceClub {
  aliases: string[];
  kind: ClubKind;
  name: string;
  shortName: string;
  slug: string;
  transfermarktId: string;
}

export interface SourcePlayer {
  name: string;
  slug: string;
  transfermarktId: string;
}

export interface SourceSide {
  formation: string | null;
  goals: number;
  starters: {
    position: PositionGroup;
    slot: number;
    transfermarktId: string;
  }[];
}

export interface SourceLineup {
  events: {
    addedTime: number | null;
    kind: MatchEventKind;
    minute: number | null;
    player: string | null;
    side: Side;
  }[];
  extraTime: boolean;
  shootout: { away: number; home: number } | null;
  sides: { away: SourceSide; home: SourceSide };
}

export interface SourceScore {
  algorithmVersion: string;
  computedAt: string;
  score: number;
  signals: Record<string, unknown>;
}

export interface SourceGate {
  passed: boolean;
  sides: {
    away: { guessability: number; starPower: number };
    home: { guessability: number; starPower: number };
  };
}

export interface DatasetSources {
  competitions: SourceCompetition[];
  clubs: SourceClub[];
  matches: ResolvedMatch[];
  // By spieler id
  players: Map<string, SourcePlayer>;
  aliases: Map<string, string[]>;
  // By match slug
  lineups: Map<string, SourceLineup>;
  scores: Map<string, SourceScore>;
  gate: Map<string, SourceGate>;
}

export type LeftReason = 'no lineup' | 'not scored' | 'failed the gate';

export interface DatasetBuild {
  dataset: DatasetInput;
  left: { slug: string; reason: LeftReason }[];
  // Events with no minute, per match slug
  droppedEvents: { slug: string; count: number }[];
  // Players in no XI, only in an event
  eventOnly: string[];
}

function bySlug<T extends { slug: string }>(a: T, b: T): number {
  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
}

function leftReason(slug: string, sources: DatasetSources): LeftReason | null {
  if (!sources.lineups.has(slug)) return 'no lineup';
  if (!sources.scores.has(slug)) return 'not scored';
  return sources.gate.get(slug)?.passed ? null : 'failed the gate';
}

function team(side: SourceSide, players: DatasetSources['players']): Team {
  return {
    // The gate has passed both sides
    formation: side.formation ?? '',
    lineup: side.starters
      .toSorted((a, b) => a.slot - b.slot)
      .map((starter) => ({
        playerSlug: players.get(starter.transfermarktId)?.slug ?? '',
        slot: starter.slot,
        position: starter.position,
      })),
  };
}

function events(
  lineup: SourceLineup,
  players: DatasetSources['players'],
): Event[] {
  return lineup.events.flatMap((event): Event[] =>
    event.minute === null
      ? []
      : [
          {
            kind: event.kind,
            minute: event.minute,
            addedTime: event.addedTime,
            side: event.side,
            playerSlug: event.player
              ? (players.get(event.player)?.slug ?? null)
              : null,
          },
        ],
  );
}

function match(resolved: ResolvedMatch, sources: DatasetSources): Match {
  const lineup = sources.lineups.get(resolved.slug)!;
  const score = sources.scores.get(resolved.slug)!;
  const gate = sources.gate.get(resolved.slug)!;
  return {
    slug: resolved.slug,
    transfermarktId: resolved.transfermarktId,
    competitionSlug: resolved.competition,
    season: resolved.season,
    date: resolved.date,
    stage: resolved.stage,
    nickname: null,
    homeClubSlug: resolved.home,
    awayClubSlug: resolved.away,
    score: { home: lineup.sides.home.goals, away: lineup.sides.away.goals },
    extraTime: lineup.extraTime,
    shootout: lineup.shootout
      ? { home: lineup.shootout.home, away: lineup.shootout.away }
      : null,
    home: team(lineup.sides.home, sources.players),
    away: team(lineup.sides.away, sources.players),
    events: events(lineup, sources.players),
    memorability: {
      score: score.score,
      // S10's signals, with S13's whole sides block
      signals: { ...score.signals, sides: gate.sides },
      algorithmVersion: score.algorithmVersion,
      computedAt: score.computedAt,
    },
  };
}

// Gate-passed matches and what they use
export function buildDataset(sources: DatasetSources): DatasetBuild {
  const left: DatasetBuild['left'] = [];
  const kept: ResolvedMatch[] = [];
  for (const resolved of sources.matches.toSorted(bySlug)) {
    const reason = leftReason(resolved.slug, sources);
    if (reason) left.push({ slug: resolved.slug, reason });
    else kept.push(resolved);
  }
  const matches = kept.map((resolved) => match(resolved, sources));
  const droppedEvents = kept.flatMap((resolved) => {
    const count = sources.lineups
      .get(resolved.slug)!
      .events.filter((e) => e.minute === null).length;
    return count > 0 ? [{ slug: resolved.slug, count }] : [];
  });

  const competitionSlugs = new Set(matches.map((m) => m.competitionSlug));
  const clubSlugs = new Set(
    matches.flatMap((m) => [m.homeClubSlug, m.awayClubSlug]),
  );
  const starters = new Set(
    matches.flatMap((m) =>
      SIDES.flatMap((side) => m[side].lineup.map((e) => e.playerSlug)),
    ),
  );
  const scorers = matches.flatMap((m) =>
    m.events.flatMap((e) => (e.playerSlug ? [e.playerSlug] : [])),
  );
  const playerSlugs = new Set([...starters, ...scorers]);
  const players = [...sources.players.values()]
    .filter((p) => playerSlugs.has(p.slug))
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      imageKey: null,
      transfermarktId: p.transfermarktId,
      aliases: sources.aliases.get(p.transfermarktId) ?? [],
    }))
    .toSorted(bySlug);

  return {
    dataset: {
      competitions: sources.competitions
        .filter((c) => competitionSlugs.has(c.slug))
        .map((c) => ({ slug: c.slug, kind: c.kind, name: c.name }))
        .toSorted(bySlug),
      clubs: sources.clubs
        .filter((c) => clubSlugs.has(c.slug))
        .map((c) => ({
          slug: c.slug,
          kind: c.kind,
          name: c.name,
          shortName: c.shortName,
          crestKey: null,
          transfermarktId: c.transfermarktId,
          aliases: c.aliases,
        }))
        .toSorted(bySlug),
      players,
      matches,
    },
    left,
    droppedEvents,
    eventOnly: [...new Set(scorers)].filter((s) => !starters.has(s)).toSorted(),
  };
}
