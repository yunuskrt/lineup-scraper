import type { DatasetBuild } from '@/dataset/build.js';

function section(title: string, lines: string[]): string[] {
  return lines.length === 0
    ? []
    : [`## ${title}`, '', ...lines.map((l) => `- ${l}`), ''];
}

// Local: slugs and counts, never a name
export function renderReport(
  build: DatasetBuild,
  files: Map<string, string>,
): string {
  const { dataset } = build;
  const reasons = new Map<string, number>();
  for (const { reason } of build.left) {
    reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
  }
  const lines = [
    '# Dataset',
    '',
    `Matches: ${dataset.matches.length}. Competitions: ${dataset.competitions.length}. ` +
      `Clubs: ${dataset.clubs.length}. Players: ${dataset.players.length}. ` +
      `Pool matches left out: ${build.left.length}.`,
    '',
    ...section(
      'Files',
      [...files.keys()].toSorted().map((path) => `\`${path}\``),
    ),
    ...section(
      'Left out, by reason',
      [...reasons]
        .toSorted(([a], [b]) => (a < b ? -1 : 1))
        .map(([reason, count]) => `${reason}: ${count}`),
    ),
    ...section(
      'Left out',
      build.left.map((l) => `\`${l.slug}\`: ${l.reason}`),
    ),
    ...section(
      'Events left out for an unknown minute',
      build.droppedEvents.map((d) => `\`${d.slug}\`: ${d.count}`),
    ),
    ...section(
      'Players only in an event (a substitute who scored)',
      build.eventOnly.map((slug) => `\`${slug}\``),
    ),
  ];
  return `${lines.join('\n').trimEnd()}\n`;
}
