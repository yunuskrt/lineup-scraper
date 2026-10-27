import type { PlayersResolved } from '@/resolve/players.js';
import type { Resolved } from '@/resolve/resolve.js';

function section(title: string, lines: string[]): string[] {
  return lines.length === 0
    ? []
    : [`## ${title}`, '', ...lines.map((l) => `- ${l}`), ''];
}

function playerLines(players: PlayersResolved): string[] {
  return [
    `Players: ${players.players.length}. Starters waiting for a player page: ${players.waiting.length}.`,
    '',
    ...section(
      'Player slug clashes (birth year or id added)',
      players.clashes.map((c) => `\`${c}\``),
    ),
    ...section(
      'No player slug (add one to crosswalk/players.json by hand)',
      players.unslugged.map((u) => `\`${u.key}\`: ${u.reason}`),
    ),
    ...section(
      'Starters waiting for a player page (S11b)',
      players.waiting.map((id) => `\`${id}\``),
    ),
  ];
}

// Ids, slugs and codes only, never an XI
export function renderReport(
  resolved: Resolved,
  players?: PlayersResolved,
): string {
  const added = (['competitions', 'clubs', 'matches'] as const).flatMap(
    (entity) =>
      Object.entries(resolved.added[entity]).map(
        ([key, slug]: [string, string]) => `${entity} \`${key}\` → \`${slug}\``,
      ),
  );
  if (players) {
    added.push(
      ...Object.entries(players.added).map(
        ([key, slug]: [string, string]) => `players \`${key}\` → \`${slug}\``,
      ),
    );
  }
  const lines = [
    '# Resolve',
    '',
    `Competitions: ${resolved.competitions.length}. Seasons: ${resolved.seasons.length}. ` +
      `Clubs: ${resolved.clubs.length}. Matches: ${resolved.matches.length}. ` +
      `Held back: ${resolved.held.length}.`,
    '',
    ...section('New slugs', added),
    ...section(
      'Held back',
      resolved.held.map((h) => `\`${h.id}\`: ${h.reason}`),
    ),
    ...section(
      'No slug (add one to the crosswalk by hand)',
      resolved.unslugged.map((u) => `${u.entity} \`${u.key}\`: ${u.reason}`),
    ),
    ...section(
      'Stage text not in data/curation/stage-names.json',
      resolved.unmappedStages.map((u) => `\`${u.id}\`: \`${u.reason}\``),
    ),
    ...section(
      'Default shortName (set one in data/curation/club-names.json)',
      resolved.defaultShortNames,
    ),
    ...(players ? playerLines(players) : []),
  ];
  return `${lines.join('\n').trimEnd()}\n`;
}
