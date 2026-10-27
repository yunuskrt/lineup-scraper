import { FUZZY_THRESHOLD, similarity } from '@/aliases/similarity.js';
import type { Side } from '@/dataset/enums.js';
import { normalizeName } from '@/names/normalize.js';

export interface XiSide {
  match: string;
  side: Side;
  // Starters' Transfermarkt ids
  starters: string[];
}

export interface PlayerAliases {
  slug: string;
  aliases: string[];
}

export interface SharedAlias {
  match: string;
  side: Side;
  alias: string;
  players: string[];
}

export interface FuzzyNeighbour {
  match: string;
  side: Side;
  aliases: [string, string];
  players: [string, string];
  score: number;
}

export interface Starter {
  match: string;
  side: Side;
  player: string;
}

export interface XiFindings {
  shared: SharedAlias[];
  fuzzy: FuzzyNeighbour[];
  unrevealable: Starter[];
  // Starters with no alias set at all
  missing: Starter[];
}

type At = Pick<XiSide, 'match' | 'side'>;

interface Entry {
  slug: string;
  normalized: string[];
}

function sharedIn(at: At, entries: Entry[]): SharedAlias[] {
  const owners = new Map<string, string[]>();
  for (const entry of entries) {
    for (const alias of new Set(entry.normalized)) {
      owners.set(alias, [...(owners.get(alias) ?? []), entry.slug]);
    }
  }
  return [...owners]
    .filter(([, players]) => players.length > 1)
    .map(([alias, players]) => ({ ...at, alias, players }));
}

// Edits are at least the length gap: a cheap bound
function canClear(a: string, b: string): boolean {
  const longest = Math.max(a.length, b.length);
  return 1 - Math.abs(a.length - b.length) / longest > FUZZY_THRESHOLD;
}

function fuzzyIn(at: At, entries: Entry[]): FuzzyNeighbour[] {
  const found: FuzzyNeighbour[] = [];
  entries.forEach((a, i) => {
    for (const b of entries.slice(i + 1)) {
      for (const x of a.normalized) {
        for (const y of b.normalized) {
          if (!canClear(x, y)) continue;
          const score = similarity(x, y);
          // An equal alias is shared, not fuzzy
          if (x !== y && score > FUZZY_THRESHOLD) {
            found.push({
              ...at,
              aliases: [x, y],
              players: [a.slug, b.slug],
              score,
            });
          }
        }
      }
    }
  });
  return found;
}

export function checkXis(
  xis: XiSide[],
  aliases: Map<string, PlayerAliases>,
): XiFindings {
  const findings: XiFindings = {
    shared: [],
    fuzzy: [],
    unrevealable: [],
    missing: [],
  };
  for (const xi of xis) {
    const at: At = { match: xi.match, side: xi.side };
    const entries: Entry[] = [];
    for (const id of xi.starters) {
      const player = aliases.get(id);
      if (!player) {
        findings.missing.push({ ...at, player: id });
        continue;
      }
      entries.push({
        slug: player.slug,
        normalized: player.aliases.map(normalizeName),
      });
    }
    const shared = sharedIn(at, entries);
    const sharedAliases = new Set(shared.map((s) => s.alias));
    findings.shared.push(...shared);
    findings.fuzzy.push(...fuzzyIn(at, entries));
    for (const entry of entries) {
      if (entry.normalized.every((alias) => sharedAliases.has(alias))) {
        findings.unrevealable.push({ ...at, player: entry.slug });
      }
    }
  }
  return findings;
}
