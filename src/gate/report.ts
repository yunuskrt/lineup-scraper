import { failureText, type GateResult } from '@/gate/gate.js';

function section(title: string, lines: string[]): string[] {
  return lines.length === 0
    ? []
    : [`## ${title}`, '', ...lines.map((l) => `- ${l}`), ''];
}

// `breaks 4-4-2` and `10 starters` count as one rule
function ruleOf(rule: string): string {
  if (rule.startsWith('breaks ')) return 'breaks its formation';
  return /^[0-9]+ starters$/.test(rule) ? 'not 11 starters' : rule;
}

function byRule(results: GateResult[]): string[] {
  const counts = new Map<string, number>();
  for (const failure of results.flatMap((r) => r.failures)) {
    const rule = ruleOf(failure.rule);
    counts.set(rule, (counts.get(rule) ?? 0) + 1);
  }
  return [...counts]
    .toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([rule, count]) => `${rule}: ${count}`);
}

// Local: slugs, sides and slots, never a name
export function renderReport(results: GateResult[], waiting: string[]): string {
  const failed = results.filter((r) => !r.passed);
  const below = results.flatMap((r) =>
    (['home', 'away'] as const)
      .filter((side) => r.sides[side].guessability < 1)
      .map(
        (side) =>
          `\`${r.slug}\` ${side}: ${r.sides[side].guessability.toFixed(4)}`,
      ),
  );
  const lines = [
    '# Gate',
    '',
    `Matches checked: ${results.length}. Passed: ${results.length - failed.length}. ` +
      `Failed: ${failed.length}. Waiting for a match report: ${waiting.length}.`,
    '',
    ...section('Failures by rule', byRule(results)),
    ...section(
      'Failed matches (fix aliases in data/curation/aliases.json)',
      failed.map(
        (r) => `\`${r.slug}\`: ${r.failures.map(failureText).join('; ')}`,
      ),
    ),
    ...section('Sides with guessability below 1', below),
    ...section(
      'Waiting for a match report (s11-match-reports)',
      waiting.map((slug) => `\`${slug}\``),
    ),
  ];
  return `${lines.join('\n').trimEnd()}\n`;
}
