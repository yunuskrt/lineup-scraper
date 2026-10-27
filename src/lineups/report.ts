import {
  resultAgreement,
  type Issue,
  type Lineups,
} from '@/lineups/lineups.js';
import type { Score } from '@/lineups/score.js';

function section(title: string, lines: string[]): string[] {
  return lines.length === 0
    ? []
    : [`## ${title}`, '', ...lines.map((l) => `- ${l}`), ''];
}

function issues(items: Issue[]): string[] {
  return items.map((i) => `\`${i.slug}\`: ${i.reason}`);
}

function shown(score: Score): string {
  return `${score.home}:${score.away}`;
}

// Slugs, counts and codes only, never an XI or a name
export function renderReport(lineups: Lineups): string {
  const results = lineups.results
    .map((r) => ({ ...r, agreement: resultAgreement(r) }))
    .filter((r) => r.shootout !== null || r.agreement !== 'equal')
    .map(
      (r) =>
        `\`${r.slug}\`: fixture \`${r.fixture ?? 'none'}\`, goals ${shown(r.goals)}` +
        (r.shootout ? `, shootout ${shown(r.shootout)}` : '') +
        ` → ${r.agreement}`,
    );
  const lines = [
    '# Lineups',
    '',
    `Matches read: ${lineups.matches.length}. Waiting for a match report: ${lineups.waiting.length}. ` +
      `Held back: ${lineups.held.length}. Sides not mapped: ${lineups.sides.length}.`,
    '',
    ...section('Held back', issues(lineups.held)),
    ...section('Sides with no formation or no slots', issues(lineups.sides)),
    ...section(
      'Events with an unknown minute (kept, left out of the load)',
      issues(lineups.unknownMinutes),
    ),
    ...section(
      'Cards that are neither yellow nor red',
      issues(lineups.unreadCards),
    ),
    ...section(
      'Fixture result against the report (shootouts and differences)',
      results,
    ),
    ...section(
      'Formation texts seen (add named shapes to data/curation/formations.json)',
      lineups.formations.map(([text, count]) => `\`${text}\`: ${count}`),
    ),
    ...section(
      'Waiting for a match report (s11-match-reports)',
      lineups.waiting.map((slug) => `\`${slug}\``),
    ),
  ];
  return `${lines.join('\n').trimEnd()}\n`;
}
