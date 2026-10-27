import { ALIAS_SOURCES, type AliasSets } from '@/aliases/build.js';
import type { XiFindings } from '@/aliases/xi.js';

function section(title: string, lines: string[]): string[] {
  return lines.length === 0
    ? []
    : [`## ${title}`, '', ...lines.map((l) => `- ${l}`), ''];
}

// Local only: names slugs and normalised aliases
export function renderReport(sets: AliasSets, xis: XiFindings): string {
  const total = ALIAS_SOURCES.reduce((sum, s) => sum + sets.kept[s], 0);
  const bySource = ALIAS_SOURCES.map((s) => `${s} ${sets.kept[s]}`).join(', ');
  const lines = [
    '# Aliases',
    '',
    `Players: ${sets.players.length}. Aliases kept: ${total} (${bySource}). ` +
      `Names dropped: ${sets.dropped.length}.`,
    '',
    `Inside an XI: ${xis.shared.length} shared aliases, ${xis.fuzzy.length} fuzzy neighbours, ` +
      `${xis.unrevealable.length} unrevealable starters, ${xis.missing.length} starters with no aliases.`,
    '',
    ...section(
      'Names dropped (D2: a dot; not latin: normalises to nothing; removed in curation)',
      sets.dropped.map((d) => `\`${d.slug}\`: ${d.source}, ${d.reason}`),
    ),
    ...section(
      'Curation warnings (data/curation/aliases.json)',
      sets.warnings.map((w) => `\`${w.at}\`: ${w.reason}`),
    ),
    ...section(
      'Shared aliases (at play time, neither player is revealed by it)',
      xis.shared.map(
        (s) =>
          `\`${s.match}\` ${s.side}: \`${s.alias}\` → ${s.players.map((p) => `\`${p}\``).join(', ')}`,
      ),
    ),
    ...section(
      'Fuzzy neighbours (a typo could hit the other player)',
      xis.fuzzy.map(
        (f) =>
          `\`${f.match}\` ${f.side}: \`${f.aliases[0]}\` ~ \`${f.aliases[1]}\` ` +
          `(${f.score.toFixed(2)}) → \`${f.players[0]}\`, \`${f.players[1]}\``,
      ),
    ),
    ...section(
      'Unrevealable starters (no alias of their own in the XI; S13 decides)',
      xis.unrevealable.map((u) => `\`${u.match}\` ${u.side}: \`${u.player}\``),
    ),
    ...section(
      'Starters with no aliases (no resolved player)',
      xis.missing.map((m) => `\`${m.match}\` ${m.side}: spieler ${m.player}`),
    ),
  ];
  return `${lines.join('\n').trimEnd()}\n`;
}
