// A surname starts at the first of these
const PARTICLES = new Set([
  'van',
  'von',
  'der',
  'den',
  'de',
  'del',
  'della',
  'di',
  'da',
  'dos',
  'das',
  'du',
  'le',
  'la',
  'ter',
  'ten',
]);

// `Del Piero`, never `Piero`; none for a mononym
export function surname(displayName: string): string | null {
  const words = displayName.trim().split(/\s+/);
  if (words.length < 2) return null;
  const particle = words.findIndex(
    (word, i) =>
      i > 0 && i < words.length - 1 && PARTICLES.has(word.toLowerCase()),
  );
  return words.slice(particle > 0 ? particle : words.length - 1).join(' ');
}
