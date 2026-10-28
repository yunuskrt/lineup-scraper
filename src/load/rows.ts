import type {
  ClubKind,
  CompetitionKind,
  MatchEventKind,
  PositionGroup,
  Side,
} from '@/dataset/enums.js';
import type { DatasetInput } from '@/dataset/schema.js';
import { normalizeName } from '@/names/normalize.js';

// Content rows by natural keys, never by uuid

export interface CompetitionRow {
  slug: string;
  kind: CompetitionKind;
  name: string;
}

export interface SeasonRow {
  competition: string;
  label: string;
  startYear: number;
}

export interface ClubRow {
  slug: string;
  kind: ClubKind;
  name: string;
  shortName: string;
  crestKey: string | null;
  transfermarktId: string | null;
}

export interface ClubAliasRow {
  club: string;
  alias: string;
}

export interface PlayerRow {
  slug: string;
  name: string;
  imageKey: string | null;
  transfermarktId: string | null;
}

export interface PlayerAliasRow {
  player: string;
  alias: string;
  normalized: string;
}

export interface MatchRow {
  slug: string;
  competition: string;
  season: string;
  // YYYY-MM-DD
  date: string;
  stage: string | null;
  nickname: string | null;
  extraTime: boolean;
  shootoutHome: number | null;
  shootoutAway: number | null;
  transfermarktId: string | null;
}

export interface MatchTeamRow {
  match: string;
  side: Side;
  club: string;
  goals: number;
  formation: string | null;
}

export interface LineupRow {
  match: string;
  side: Side;
  slot: number;
  player: string;
  position: PositionGroup;
}

export interface EventRow {
  match: string;
  kind: MatchEventKind;
  minute: number;
  addedTime: number | null;
  side: Side;
  player: string | null;
}

export interface ScoreRow {
  match: string;
  score: number;
  // Canonical JSON, so equal signals compare equal
  signals: string;
  algorithmVersion: string;
  // ISO, with milliseconds, as Postgres returns it
  computedAt: string;
}

export interface ContentRows {
  competitions: CompetitionRow[];
  seasons: SeasonRow[];
  clubs: ClubRow[];
  clubAliases: ClubAliasRow[];
  players: PlayerRow[];
  playerAliases: PlayerAliasRow[];
  matches: MatchRow[];
  matchTeams: MatchTeamRow[];
  lineups: LineupRow[];
  matchEvents: EventRow[];
  memorabilityScores: ScoreRow[];
}

const SIDES: readonly Side[] = ['home', 'away'];

// Sorted keys at every depth
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_, inner: unknown) =>
    inner && typeof inner === 'object' && !Array.isArray(inner)
      ? Object.fromEntries(
          Object.entries(inner).toSorted(([a], [b]) => (a < b ? -1 : 1)),
        )
      : inner,
  );
}

export function isoInstant(value: string): string {
  return new Date(value).toISOString();
}

// What the dataset asks the database to hold
export function wantedRows(dataset: DatasetInput): ContentRows {
  const seasons = new Map<string, SeasonRow>();
  for (const m of dataset.matches) {
    seasons.set(`${m.competitionSlug}|${m.season}`, {
      competition: m.competitionSlug,
      label: m.season,
      startYear: Number(m.season.slice(0, 4)),
    });
  }
  return {
    competitions: dataset.competitions.map(({ slug, kind, name }) => ({
      slug,
      kind,
      name,
    })),
    seasons: [...seasons.values()],
    clubs: dataset.clubs.map((c) => ({
      slug: c.slug,
      kind: c.kind,
      name: c.name,
      shortName: c.shortName,
      crestKey: c.crestKey,
      transfermarktId: c.transfermarktId,
    })),
    clubAliases: dataset.clubs.flatMap((c) =>
      c.aliases.map((alias) => ({ club: c.slug, alias })),
    ),
    players: dataset.players.map((p) => ({
      slug: p.slug,
      name: p.name,
      imageKey: p.imageKey,
      transfermarktId: p.transfermarktId,
    })),
    playerAliases: dataset.players.flatMap((p) =>
      p.aliases.map((alias) => ({
        player: p.slug,
        alias,
        normalized: normalizeName(alias),
      })),
    ),
    matches: dataset.matches.map((m) => ({
      slug: m.slug,
      competition: m.competitionSlug,
      season: m.season,
      date: m.date,
      stage: m.stage,
      nickname: m.nickname,
      extraTime: m.extraTime,
      shootoutHome: m.shootout?.home ?? null,
      shootoutAway: m.shootout?.away ?? null,
      transfermarktId: m.transfermarktId,
    })),
    matchTeams: dataset.matches.flatMap((m) =>
      SIDES.map((side) => ({
        match: m.slug,
        side,
        club: side === 'home' ? m.homeClubSlug : m.awayClubSlug,
        goals: m.score[side],
        formation: m[side].formation,
      })),
    ),
    lineups: dataset.matches.flatMap((m) =>
      SIDES.flatMap((side) =>
        m[side].lineup.map((e) => ({
          match: m.slug,
          side,
          slot: e.slot,
          player: e.playerSlug,
          position: e.position,
        })),
      ),
    ),
    matchEvents: dataset.matches.flatMap((m) =>
      m.events.map((e) => ({
        match: m.slug,
        kind: e.kind,
        minute: e.minute,
        addedTime: e.addedTime,
        side: e.side,
        player: e.playerSlug,
      })),
    ),
    memorabilityScores: dataset.matches.map((m) => ({
      match: m.slug,
      score: m.memorability.score,
      signals: canonicalJson(m.memorability.signals),
      algorithmVersion: m.memorability.algorithmVersion,
      computedAt: isoInstant(m.memorability.computedAt),
    })),
  };
}
