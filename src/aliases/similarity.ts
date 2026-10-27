// Ported from the backend's src/game/matcher.ts
// Keeps "ronaldo" off "ronaldinho" (0.70 apart)
export const FUZZY_THRESHOLD = 0.82;

// Restricted Damerau-Levenshtein: a swap costs 1
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const rows: number[][] = [Array.from({ length: b.length + 1 }, (_, j) => j)];
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(
        current[j - 1] + 1,
        rows[i - 1][j] + 1,
        rows[i - 1][j - 1] + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, rows[i - 2][j - 2] + 1);
      }
      current[j] = value;
    }
    rows.push(current);
  }
  return rows[a.length][b.length];
}

export function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return 1 - editDistance(a, b) / longest;
}

// Edits ≥ the length gap: a cheap bound
export function canClear(a: string, b: string): boolean {
  const longest = Math.max(a.length, b.length);
  return 1 - Math.abs(a.length - b.length) / longest > FUZZY_THRESHOLD;
}

// Two different aliases a typo could confuse
export function areNeighbours(a: string, b: string): boolean {
  return a !== b && canClear(a, b) && similarity(a, b) > FUZZY_THRESHOLD;
}
