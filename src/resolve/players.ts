import type { Crosswalk } from '@/resolve/curation.js';
import { extendCrosswalk, toSlug } from '@/resolve/slugs.js';
import type { TransfermarktMatch } from '@/raw/transfermarkt-match.js';
import type { TransfermarktPlayer } from '@/raw/transfermarkt-player.js';

// `#11 Raphinha`: the current shirt number, not part of the name
const SHIRT_NUMBER = /^#[0-9]+(\s+|$)/;
const BIRTH_YEAR = /^[0-9]{2}\/[0-9]{2}\/([0-9]{4})/;

export function displayName(headline: string): string {
  return headline.replace(SHIRT_NUMBER, '').trim();
}

// `14/12/1996 (29)` → 1996
export function birthYear(dateOfBirth: string | null): string | null {
  return BIRTH_YEAR.exec(dateOfBirth ?? '')?.[1] ?? null;
}

interface Sighting {
  id: string;
  name: string;
  isStarter: boolean;
}

// Every player a match report names, with the name it shows
export function sightings(match: TransfermarktMatch): Sighting[] {
  const sides = [match.home, match.away];
  return [
    ...sides.flatMap((s) =>
      s.starters.map((p) => ({
        id: p.sourceId,
        name: p.name,
        isStarter: true,
      })),
    ),
    ...sides.flatMap((s) =>
      s.bench.map((p) => ({ id: p.sourceId, name: p.name, isStarter: false })),
    ),
    ...match.events.flatMap((e) =>
      e.players.map((p) => ({
        id: p.sourceId,
        name: p.name,
        isStarter: false,
      })),
    ),
  ];
}

// Keys in alphabetical order: the file's key order
export interface ResolvedPlayer {
  aliasCandidates: string[];
  name: string;
  slug: string;
  transfermarktId: string;
}

export interface PlayersResolved {
  players: ResolvedPlayer[];
  crosswalk: Crosswalk;
  added: Crosswalk;
  // Starters with no saved player page: the S11b list
  waiting: string[];
  // New slugs that needed a birth year or an id
  clashes: string[];
  unslugged: { key: string; reason: string }[];
}

function byNumber(a: string, b: string): number {
  return Number(a) - Number(b);
}

function byText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function resolvePlayers(
  poolReports: TransfermarktMatch[],
  profiles: Map<string, TransfermarktPlayer>,
  previous: Crosswalk,
): PlayersResolved {
  const seen = new Map<string, Set<string>>();
  const starters = new Set<string>();
  for (const s of poolReports.flatMap(sightings)) {
    seen.set(s.id, (seen.get(s.id) ?? new Set()).add(s.name));
    if (s.isStarter) starters.add(s.id);
  }
  const named = [...seen.keys()]
    .filter((id) => profiles.has(id))
    .toSorted(byNumber);
  const names = new Map(
    named.map((id) => [id, displayName(profiles.get(id)!.headline)]),
  );
  const wanted = named.map((id) => {
    const base = toSlug(names.get(id)!);
    const year = birthYear(profiles.get(id)!.dateOfBirth);
    return {
      key: id,
      base,
      fallbacks: base && year ? [`${base}-${year}`] : [],
    };
  });
  const walk = extendCrosswalk(previous, wanted);
  const added = Object.fromEntries(
    walk.added.map((id) => [id, walk.crosswalk[id]!]),
  );
  return {
    players: named
      .flatMap((id): ResolvedPlayer[] => {
        const slug = walk.crosswalk[id];
        const name = names.get(id)!;
        if (!slug) return [];
        const others = [...seen.get(id)!]
          .filter((n) => n !== name)
          .toSorted(byText);
        return [{ aliasCandidates: others, name, slug, transfermarktId: id }];
      })
      .toSorted((a, b) => byText(a.slug, b.slug)),
    crosswalk: walk.crosswalk,
    added,
    waiting: [...starters].filter((id) => !profiles.has(id)).toSorted(byNumber),
    clashes: walk.added
      .filter((id) => walk.crosswalk[id] !== toSlug(names.get(id)!))
      .map((id) => `${id} → ${walk.crosswalk[id]}`),
    unslugged: walk.unslugged,
  };
}
