import { normalizeName } from '@/names/normalize.js';
import type { ClubNames } from '@/resolve/curation.js';

// Club id → each name the pages used, with its count
export type NameCounts = Map<string, Map<string, number>>;

export interface ClubDraft {
  id: string;
  kind: 'club' | 'national_team';
  name: string;
  shortName: string;
  isDefaultShortName: boolean;
  aliases: string[];
}

function byText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// Most often seen; a tie goes to the first alphabetically
export function commonName(counts: Map<string, number>): string | null {
  const names = [...counts].toSorted(([a, x], [b, y]) => y - x || byText(a, b));
  return names[0]?.[0] ?? null;
}

// First 3 letters or digits, upper case
export function defaultShortName(name: string): string {
  return normalizeName(name).replaceAll(' ', '').slice(0, 3).toUpperCase();
}

export function clubDraft(
  id: string,
  isNational: boolean,
  counts: Map<string, number>,
  curated: ClubNames[string] | undefined,
): ClubDraft | null {
  const name = curated?.name ?? commonName(counts);
  if (name === null) return null;
  return {
    id,
    kind: isNational ? 'national_team' : 'club',
    name,
    shortName: curated?.shortName ?? defaultShortName(name),
    isDefaultShortName: curated?.shortName === undefined,
    aliases: [...counts.keys()]
      .filter((alias) => alias !== name)
      .toSorted(byText),
  };
}
