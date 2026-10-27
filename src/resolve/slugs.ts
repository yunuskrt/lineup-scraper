import { normalizeName } from '@/names/normalize.js';
import type { Crosswalk } from '@/resolve/curation.js';

const RESERVED_PREFIXES = ['club-', 'nat-', 'comp-', 'match-', 'pl-', 'test-'];

// null: the name has no Latin letters or digits
export function toSlug(name: string): string | null {
  const slug = normalizeName(name).replaceAll(' ', '-');
  return slug === '' ? null : slug;
}

export function isReserved(slug: string): boolean {
  return RESERVED_PREFIXES.some((prefix) => slug.startsWith(prefix));
}

export interface Wanted {
  key: string;
  base: string | null;
}

export interface Extended {
  crosswalk: Crosswalk;
  added: string[];
  // Keys left without a slug, with the reason
  unslugged: { key: string; reason: string }[];
}

// Old entries are kept as they are; new keys clash-free
export function extendCrosswalk(
  previous: Crosswalk,
  wanted: Wanted[],
): Extended {
  const crosswalk: Crosswalk = { ...previous };
  const taken = new Set(Object.values(previous));
  const added: string[] = [];
  const unslugged: Extended['unslugged'] = [];
  for (const { key, base } of wanted) {
    if (Object.hasOwn(crosswalk, key)) continue;
    if (base === null) {
      unslugged.push({ key, reason: 'name has no Latin letters' });
    } else if (isReserved(base)) {
      unslugged.push({ key, reason: 'slug starts with a reserved prefix' });
    } else {
      const slug = taken.has(base) ? `${base}-${key}` : base;
      if (taken.has(slug)) {
        unslugged.push({ key, reason: 'slug is taken' });
        continue;
      }
      crosswalk[key] = slug;
      taken.add(slug);
      added.push(key);
    }
  }
  return { crosswalk: sortByKey(crosswalk), added, unslugged };
}

// Numeric keys in number order, others alphabetical
export function sortByKey(crosswalk: Crosswalk): Crosswalk {
  const keys = Object.keys(crosswalk).toSorted((a, b) =>
    /^[0-9]+$/.test(a) && /^[0-9]+$/.test(b)
      ? Number(a) - Number(b)
      : a < b
        ? -1
        : a > b
          ? 1
          : 0,
  );
  return Object.fromEntries(keys.map((key) => [key, crosswalk[key]!]));
}

// Entries of the committed file that a hand edit changed or removed
export function changedEntries(
  committed: Crosswalk,
  current: Crosswalk,
): string[] {
  return Object.keys(committed).filter(
    (key) => current[key] !== committed[key],
  );
}

// One slug for two keys breaks the loader's key
export function duplicateSlugs(crosswalk: Crosswalk): string[] {
  const seen = new Set<string>();
  const twice = new Set<string>();
  for (const slug of Object.values(crosswalk)) {
    if (seen.has(slug)) twice.add(slug);
    seen.add(slug);
  }
  return [...twice].toSorted();
}
