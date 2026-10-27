import type { PoolBuild } from '@/pool/build.js';

export interface ListingState {
  total: number;
  // Listing page keys not in the page store yet
  unsaved: string[];
}

function counts(values: string[]): [string, number][] {
  const tally = new Map<string, number>();
  for (const value of values) tally.set(value, (tally.get(value) ?? 0) + 1);
  return [...tally].toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

function table(title: string, rows: [string, number][]): string[] {
  return [
    `## ${title}`,
    '',
    '| | Matches |',
    '| --- | --- |',
    ...rows.map(([k, n]) => `| ${k} | ${n} |`),
    '',
  ];
}

// Counts and ids only, never a team or player name
export function renderReport(
  build: PoolBuild,
  listings: ListingState | null,
): string {
  const { matches } = build;
  const lines = [
    '# Pool match list',
    '',
    `Matches: ${matches.length}. Conflicts: ${build.conflicts.length}. Excluded: ${build.excluded.length}.`,
    '',
    ...table('By group', counts(matches.flatMap((m) => m.groups))),
    ...table('By competition', counts(matches.map((m) => m.competitionCode))),
    ...table(
      'By season',
      counts(matches.map((m) => `${m.competitionCode} ${m.seasonId ?? '?'}`)),
    ),
  ];
  if (build.conflicts.length > 0) {
    lines.push(
      '## Conflicts',
      '',
      'Listing pages disagree; the match is left out until fixed.',
      '',
    );
    for (const { sourceId, fields } of build.conflicts) {
      lines.push(`- \`${sourceId}\`: ${fields.join(', ')}`);
    }
    lines.push('');
  }
  if (build.missingIncludes.length > 0) {
    lines.push('## Included but not on a saved listing page', '');
    lines.push(...build.missingIncludes.map((id) => `- \`${id}\``), '');
  }
  if (listings === null) {
    lines.push(
      '## Listing pages',
      '',
      'No `s07-listings` list: run `uv run python -m extract.lists.listings`.',
      '',
    );
  } else {
    const saved = listings.total - listings.unsaved.length;
    lines.push(
      '## Listing pages not saved yet',
      '',
      `Saved: ${saved}/${listings.total}.`,
      '',
    );
    lines.push(...listings.unsaved.map((key) => `- \`${key}\``), '');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}
