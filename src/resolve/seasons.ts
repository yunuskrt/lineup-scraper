import { startYear } from '@/pool/config.js';

// 2002 → 2002-03; a World Cup or Euro saison_id is the year before
export function seasonLabel(kind: string, seasonId: string): string {
  const year = startYear(kind, Number(seasonId));
  if (kind === 'world_cup' || kind === 'euro') return String(year);
  return `${year}-${String((year + 1) % 100).padStart(2, '0')}`;
}
