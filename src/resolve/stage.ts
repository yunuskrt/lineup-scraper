import type { StageNames } from '@/resolve/curation.js';

// `QF 2` is tie 2 of the quarter-finals
const TIE_NUMBER = / [0-9]+$/;

// The knockout code wins; null when nothing maps
export function stageText(
  stage: string | null,
  round: string | null,
  names: StageNames,
): string | null {
  if (stage !== null) {
    return (
      names.stages[stage] ?? names.stages[stage.replace(TIE_NUMBER, '')] ?? null
    );
  }
  if (round === null) return null;
  for (const { pattern, text } of names.rounds) {
    const match = new RegExp(pattern).exec(round);
    if (match)
      return text.replace(
        /\$([0-9])/g,
        (_, i: string) => match[Number(i)] ?? '',
      );
  }
  return null;
}
