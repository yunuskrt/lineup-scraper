import type { AliasCuration } from '@/aliases/curation.js';
import { surname } from '@/aliases/surname.js';
import { normalizeName } from '@/names/normalize.js';

export const ALIAS_SOURCES = [
  'name',
  'surname',
  'report',
  'fullName',
  'curation',
] as const;
export type AliasSource = (typeof ALIAS_SOURCES)[number];

export type DropReason = 'dot' | 'not latin' | 'removed';

export interface PlayerNames {
  slug: string;
  transfermarktId: string;
  name: string;
  // Other names the match reports show
  aliasCandidates: string[];
  fullName: string | null;
  nameInHomeCountry: string | null;
}

// Alphabetical keys: the file's key order
export interface AliasedPlayer {
  aliases: string[];
  slug: string;
  transfermarktId: string;
}

export interface Dropped {
  slug: string;
  source: AliasSource;
  reason: DropReason;
}

export interface CurationWarning {
  at: string;
  reason: string;
}

export interface AliasSets {
  players: AliasedPlayer[];
  kept: Record<AliasSource, number>;
  dropped: Dropped[];
  warnings: CurationWarning[];
}

interface Candidate {
  text: string;
  source: AliasSource;
  // Its place in the curation `add` list
  index?: number;
}

// The display name and curation may carry a dot
function hasDot(candidate: Candidate): boolean {
  return (
    candidate.source !== 'name' &&
    candidate.source !== 'curation' &&
    candidate.text.includes('.')
  );
}

function candidates(player: PlayerNames, added: string[]): Candidate[] {
  const surnameOf = surname(player.name);
  const fullName = player.fullName ?? player.nameInHomeCountry;
  return [
    { text: player.name, source: 'name' as const },
    ...(surnameOf ? [{ text: surnameOf, source: 'surname' as const }] : []),
    ...player.aliasCandidates.map((text) => ({
      text,
      source: 'report' as const,
    })),
    ...(fullName ? [{ text: fullName, source: 'fullName' as const }] : []),
    ...added.map((text, index) => ({
      text,
      source: 'curation' as const,
      index,
    })),
  ];
}

// Errors name a curation path, never a name
function checkCuration(
  player: PlayerNames,
  entry: { add: string[]; remove: string[] },
): void {
  const at = `aliases.json ${player.transfermarktId}`;
  entry.add.forEach((text, i) => {
    if (normalizeName(text) === '') {
      throw new Error(`${at}.add[${i}] must normalize to a name`);
    }
  });
  const display = normalizeName(player.name);
  entry.remove.forEach((text, i) => {
    if (normalizeName(text) === display) {
      throw new Error(`${at}.remove[${i}] can't remove the display name`);
    }
  });
}

function aliasesOf(
  player: PlayerNames,
  entry: { add: string[]; remove: string[] },
  sets: AliasSets,
): string[] {
  const at = `aliases.json ${player.transfermarktId}`;
  const removed = new Set(entry.remove.map(normalizeName));
  const used = new Set<string>();
  const kept: string[] = [];
  const drop = (source: AliasSource, reason: DropReason): void => {
    sets.dropped.push({ slug: player.slug, source, reason });
  };
  for (const candidate of candidates(player, entry.add)) {
    const normalized = normalizeName(candidate.text);
    if (hasDot(candidate)) {
      drop(candidate.source, 'dot');
    } else if (normalized === '') {
      drop(candidate.source, 'not latin');
    } else if (used.has(normalized)) {
      if (candidate.index !== undefined) {
        sets.warnings.push({
          at: `${at}.add[${candidate.index}]`,
          reason: 'already an alias',
        });
      }
    } else {
      used.add(normalized);
      if (removed.has(normalized)) {
        drop(candidate.source, 'removed');
      } else {
        kept.push(candidate.text);
        sets.kept[candidate.source] += 1;
      }
    }
  }
  entry.remove.forEach((text, i) => {
    if (!used.has(normalizeName(text))) {
      sets.warnings.push({
        at: `${at}.remove[${i}]`,
        reason: 'matches no alias',
      });
    }
  });
  return kept;
}

export function buildAliases(
  players: PlayerNames[],
  curation: AliasCuration,
): AliasSets {
  const sets: AliasSets = {
    players: [],
    kept: { name: 0, surname: 0, report: 0, fullName: 0, curation: 0 },
    dropped: [],
    warnings: [],
  };
  const byId = new Map(players.map((p) => [p.transfermarktId, p]));
  for (const id of Object.keys(curation).toSorted(
    (a, b) => Number(a) - Number(b),
  )) {
    if (!byId.has(id)) {
      sets.warnings.push({
        at: `aliases.json ${id}`,
        reason: 'not a resolved player',
      });
    }
  }
  for (const player of players) {
    if (normalizeName(player.name) === '') {
      throw new Error(
        `Player ${player.slug}: display name must normalize to a name`,
      );
    }
    const entry = curation[player.transfermarktId] ?? { add: [], remove: [] };
    checkCuration(player, entry);
    sets.players.push({
      aliases: aliasesOf(player, entry, sets),
      slug: player.slug,
      transfermarktId: player.transfermarktId,
    });
  }
  sets.players.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  return sets;
}
