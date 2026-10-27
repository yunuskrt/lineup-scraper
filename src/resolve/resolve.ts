import { z } from 'zod';
import { matchSeasonIssue } from '@/dataset/season.js';
import { digitsSchema, isoDateSchema } from '@/raw/envelope.js';
import type { CompetitionKind } from '@/dataset/enums.js';
import type { PoolMatch } from '@/pool/build.js';
import type { PoolConfig } from '@/pool/config.js';
import { clubDraft, type ClubDraft, type NameCounts } from '@/resolve/clubs.js';
import type { ClubNames, Crosswalk, StageNames } from '@/resolve/curation.js';
import { seasonLabel } from '@/resolve/seasons.js';
import { extendCrosswalk, toSlug, type Extended } from '@/resolve/slugs.js';
import { stageText } from '@/resolve/stage.js';

const NATIONAL_KINDS = new Set<CompetitionKind>(['world_cup', 'euro']);

export interface Crosswalks {
  competitions: Crosswalk;
  clubs: Crosswalk;
  matches: Crosswalk;
}

export interface ResolveInput {
  config: PoolConfig;
  matches: PoolMatch[];
  names: NameCounts;
  clubNames: ClubNames;
  stageNames: StageNames;
  crosswalks: Crosswalks;
}

// Keys in alphabetical order: the files' key order
export interface ResolvedCompetition {
  code: string;
  kind: CompetitionKind;
  name: string;
  slug: string;
}

export interface ResolvedSeason {
  competition: string;
  label: string;
  startYear: number;
}

export interface ResolvedClub {
  aliases: string[];
  kind: 'club' | 'national_team';
  name: string;
  shortName: string;
  slug: string;
  transfermarktId: string;
}

// data/work/resolved/matches.json, read by later stages
export const resolvedMatchSchema = z.strictObject({
  away: z.string().min(1),
  competition: z.string().min(1),
  date: isoDateSchema,
  groups: z.array(z.string()),
  home: z.string().min(1),
  season: z.string().min(1),
  slug: z.string().min(1),
  stage: z.string().nullable(),
  transfermarktId: digitsSchema,
});
export type ResolvedMatch = z.infer<typeof resolvedMatchSchema>;

export interface Held {
  id: string;
  reason: string;
}

export interface Resolved {
  competitions: ResolvedCompetition[];
  seasons: ResolvedSeason[];
  clubs: ResolvedClub[];
  matches: ResolvedMatch[];
  crosswalks: Crosswalks;
  added: Crosswalks;
  unslugged: { entity: string; key: string; reason: string }[];
  held: Held[];
  unmappedStages: Held[];
  defaultShortNames: string[];
}

function bySlug<T extends { slug: string }>(items: T[]): T[] {
  return items.toSorted((a, b) =>
    a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0,
  );
}

function addedSlugs(extended: Extended): Crosswalk {
  return Object.fromEntries(
    extended.added.map((key) => [key, extended.crosswalk[key]!]),
  );
}

type Competition = PoolConfig['competitions'][number];
type Unslugged = Resolved['unslugged'];

function note(entity: string, extended: Extended, into: Unslugged): Extended {
  into.push(...extended.unslugged.map((u) => ({ entity, ...u })));
  return extended;
}

function resolveClubs(
  input: ResolveInput,
  used: PoolMatch[],
  competitions: Map<string, Competition>,
  unslugged: Unslugged,
): { drafts: ClubDraft[]; walk: Extended } {
  const national = new Set(
    used
      .filter((m) =>
        NATIONAL_KINDS.has(competitions.get(m.competitionCode)!.kind),
      )
      .flatMap((m) => [m.home, m.away]),
  );
  const ids = [...new Set(used.flatMap((m) => [m.home, m.away]))].toSorted(
    (a, b) => Number(a) - Number(b),
  );
  const drafts = ids.flatMap((id) => {
    const counts = input.names.get(id) ?? new Map<string, number>();
    const draft = clubDraft(id, national.has(id), counts, input.clubNames[id]);
    if (draft === null)
      unslugged.push({ entity: 'club', key: id, reason: 'no name seen' });
    return draft === null ? [] : [draft];
  });
  const wanted = drafts.map((d) => ({ key: d.id, base: toSlug(d.name) }));
  return {
    drafts,
    walk: note(
      'club',
      extendCrosswalk(input.crosswalks.clubs, wanted),
      unslugged,
    ),
  };
}

interface MatchDraft {
  base: string;
  match: Omit<ResolvedMatch, 'slug'>;
}

// A match the database could refuse is held back
function matchDraft(
  m: PoolMatch,
  competition: Competition,
  slugs: { competition?: string; home?: string; away?: string },
  out: { held: Held[]; unmapped: Held[]; seasons: Map<string, ResolvedSeason> },
  stageNames: StageNames,
): MatchDraft | null {
  const { competition: competitionSlug, home, away } = slugs;
  if (!competitionSlug || !home || !away) {
    out.held.push({
      id: m.sourceId,
      reason: 'a competition or club has no slug',
    });
    return null;
  }
  if (m.date === null || m.seasonId === null) {
    out.held.push({
      id: m.sourceId,
      reason: 'no date or season on the listing page',
    });
    return null;
  }
  const label = seasonLabel(competition.kind, m.seasonId);
  const issue = matchSeasonIssue(competition.kind, label, m.date);
  if (issue !== null) {
    out.held.push({ id: m.sourceId, reason: issue });
    return null;
  }
  out.seasons.set(`${competitionSlug}|${label}`, {
    competition: competitionSlug,
    label,
    startYear: Number(label.slice(0, 4)),
  });
  const stage = stageText(m.stage, m.round, stageNames);
  if (stage === null && (m.stage ?? m.round) !== null) {
    out.unmapped.push({ id: m.sourceId, reason: (m.stage ?? m.round)! });
  }
  return {
    base: `${m.date}-${home}-${away}`,
    match: {
      away,
      competition: competitionSlug,
      date: m.date,
      groups: m.groups,
      home,
      season: label,
      stage,
      transfermarktId: m.sourceId,
    },
  };
}

function withSlug(
  match: Omit<ResolvedMatch, 'slug'>,
  slug: string,
): ResolvedMatch {
  const {
    away,
    competition,
    date,
    groups,
    home,
    season,
    stage,
    transfermarktId,
  } = match;
  return {
    away,
    competition,
    date,
    groups,
    home,
    season,
    slug,
    stage,
    transfermarktId,
  };
}

function bySeason(a: ResolvedSeason, b: ResolvedSeason): number {
  if (a.competition !== b.competition)
    return a.competition < b.competition ? -1 : 1;
  return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
}

export function resolve(input: ResolveInput): Resolved {
  const competitions = new Map(
    input.config.competitions.map((c) => [c.code, c]),
  );
  const used = input.matches.filter((m) => competitions.has(m.competitionCode));
  const unslugged: Unslugged = [];
  const out = {
    held: input.matches
      .filter((m) => !competitions.has(m.competitionCode))
      .map((m) => ({
        id: m.sourceId,
        reason: 'competition is not in pool.json',
      })),
    unmapped: [] as Held[],
    seasons: new Map<string, ResolvedSeason>(),
  };

  const codes = [...new Set(used.map((m) => m.competitionCode))].toSorted();
  const competitionWanted = codes.map((code) => ({
    key: code,
    base: toSlug(competitions.get(code)!.name),
  }));
  const competitionWalk = note(
    'competition',
    extendCrosswalk(input.crosswalks.competitions, competitionWanted),
    unslugged,
  );
  const clubs = resolveClubs(input, used, competitions, unslugged);

  const drafts = used.flatMap((m) => {
    const slugs = {
      competition: competitionWalk.crosswalk[m.competitionCode],
      home: clubs.walk.crosswalk[m.home],
      away: clubs.walk.crosswalk[m.away],
    };
    const draft = matchDraft(
      m,
      competitions.get(m.competitionCode)!,
      slugs,
      out,
      input.stageNames,
    );
    return draft === null ? [] : [draft];
  });
  const matchWanted = drafts.map((d) => ({
    key: d.match.transfermarktId,
    base: d.base,
  }));
  const matchWalk = note(
    'match',
    extendCrosswalk(input.crosswalks.matches, matchWanted),
    unslugged,
  );

  const resolvedClubs = clubs.drafts.flatMap((d): ResolvedClub[] => {
    const slug = clubs.walk.crosswalk[d.id];
    if (!slug) return [];
    const { aliases, kind, name, shortName } = d;
    return [{ aliases, kind, name, shortName, slug, transfermarktId: d.id }];
  });
  const isDefault = new Set(
    clubs.drafts.filter((d) => d.isDefaultShortName).map((d) => d.id),
  );

  return {
    competitions: bySlug(
      codes.flatMap((code) => {
        const slug = competitionWalk.crosswalk[code];
        const { kind, name } = competitions.get(code)!;
        return slug ? [{ code, kind, name, slug }] : [];
      }),
    ),
    seasons: [...out.seasons.values()].toSorted(bySeason),
    clubs: bySlug(resolvedClubs),
    matches: bySlug(
      drafts.flatMap(({ match }) => {
        const slug = matchWalk.crosswalk[match.transfermarktId];
        return slug ? [withSlug(match, slug)] : [];
      }),
    ),
    crosswalks: {
      competitions: competitionWalk.crosswalk,
      clubs: clubs.walk.crosswalk,
      matches: matchWalk.crosswalk,
    },
    added: {
      competitions: addedSlugs(competitionWalk),
      clubs: addedSlugs(clubs.walk),
      matches: addedSlugs(matchWalk),
    },
    unslugged,
    held: out.held,
    unmappedStages: out.unmapped,
    defaultShortNames: bySlug(resolvedClubs)
      .filter((c) => isDefault.has(c.transfermarktId))
      .map((c) => `${c.slug}: ${c.shortName}`),
  };
}
