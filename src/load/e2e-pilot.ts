import type { DatasetInput } from '@/dataset/schema.js';
import type { ImageKeys } from '@/images/keys.js';

// S20's three matches, cut from the full dataset
export const PILOT_MATCHES = [
  '2001-05-23-bayern-munich-valencia',
  '2002-11-06-fenerbahce-galatasaray',
  '2006-07-09-italy-france',
];

export function pilotOf(dataset: DatasetInput): DatasetInput {
  const matches = dataset.matches.filter((m) => PILOT_MATCHES.includes(m.slug));
  const competitions = new Set(matches.map((m) => m.competitionSlug));
  const clubs = new Set(
    matches.flatMap((m) => [m.homeClubSlug, m.awayClubSlug]),
  );
  const players = new Set(
    matches.flatMap((m) => [
      ...[...m.home.lineup, ...m.away.lineup].map((e) => e.playerSlug),
      ...m.events.flatMap((e) => (e.playerSlug ? [e.playerSlug] : [])),
    ]),
  );
  return {
    competitions: dataset.competitions.filter((c) => competitions.has(c.slug)),
    clubs: dataset.clubs.filter((c) => clubs.has(c.slug)),
    players: dataset.players.filter((p) => players.has(p.slug)),
    matches,
  };
}

// Only the pilot's images, to upload
export function pilotKeys(keys: ImageKeys, pilot: DatasetInput): ImageKeys {
  const slugs = (rows: { slug: string }[]) => new Set(rows.map((r) => r.slug));
  const of = <T extends { slug: string }>(entries: T[], rows: Set<string>) =>
    entries.filter((e) => rows.has(e.slug));
  return {
    crests: of(keys.crests, slugs(pilot.clubs)),
    photos: of(keys.photos, slugs(pilot.players)),
    logos: of(keys.logos, slugs(pilot.competitions)),
  };
}
