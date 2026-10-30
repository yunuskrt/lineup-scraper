import type { LinkRow } from '@/dashboard/links.js';
import type { PoolMatch } from '@/pool/build.js';
import { startYear, type PoolConfig } from '@/pool/config.js';
import { seasonLabel } from '@/resolve/seasons.js';
import { eraBucket } from '@/score/pool-rules.js';

export interface Context {
  groups: string[];
  competition: string | null;
  season: string | null;
  era: number | null;
  // Transfermarkt ids of both clubs
  clubs: string[];
  match: string | null;
}

export interface Entry extends LinkRow {
  context: Context;
}

const NO_CONTEXT: Context = {
  groups: [],
  competition: null,
  season: null,
  era: null,
  clubs: [],
  match: null,
};

function seasonContext(
  config: PoolConfig,
  code: string,
  seasonId: string | null,
): Pick<Context, 'competition' | 'season' | 'era'> {
  const competition = config.competitions.find((c) => c.code === code);
  if (!competition || seasonId === null) {
    return { competition: code, season: null, era: null };
  }
  const { kind } = competition;
  return {
    competition: code,
    season: seasonLabel(kind, seasonId),
    era: eraBucket(startYear(kind, Number(seasonId))),
  };
}

function matchContext(config: PoolConfig, match: PoolMatch): Context {
  return {
    groups: [...match.groups],
    ...seasonContext(config, match.competitionCode, match.seasonId),
    clubs: [match.home, match.away],
    match: match.sourceId,
  };
}

function fixtureContext(config: PoolConfig, key: string): Context {
  const [code = '', seasonId = null] = key.split('-');
  const groups = config.competitions.find((c) => c.code === code)?.groups;
  return {
    ...NO_CONTEXT,
    groups: [...(groups ?? [])],
    ...seasonContext(config, code, seasonId),
  };
}

// A crest, player or photo row joins the match above
export function toEntries(
  rows: readonly LinkRow[],
  matches: readonly PoolMatch[],
  config: PoolConfig,
): Entry[] {
  const byId = new Map(matches.map((m) => [m.sourceId, m]));
  let block: Context = NO_CONTEXT;
  return rows.map((row) => {
    if (row.type === 'Fixture') {
      return { ...row, context: fixtureContext(config, row.key) };
    }
    if (row.type === 'Match Report') {
      const match = byId.get(row.key);
      block = match
        ? matchContext(config, match)
        : { ...NO_CONTEXT, match: row.key };
    }
    return { ...row, context: block };
  });
}
