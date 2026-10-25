import { z } from 'zod';
import { SQUAD_SIZE } from '@/dataset/constants.js';
import type { PositionGroup } from '@/dataset/enums.js';

const OUTFIELD_SIZE = SQUAD_SIZE - 1;

// 3–5 lines covering every outfield player
export const formationSchema = z
  .string()
  .regex(/^[1-9](-[1-9]){2,4}$/)
  .refine(
    (formation) =>
      formation
        .split('-')
        .map(Number)
        .reduce((sum, line) => sum + line, 0) === OUTFIELD_SIZE,
    { error: `Formation lines must total ${OUTFIELD_SIZE} outfield players` },
  );

// Slot 0 is the GK; lines fill defence to attack
export function positionForSlot(
  formation: string,
  slot: number,
): PositionGroup | null {
  if (slot === 0) return 'GK';
  if (!Number.isInteger(slot) || slot < 0) return null;

  const lines = formation.split('-').map(Number);
  let lineStart = 1;

  for (const [index, size] of lines.entries()) {
    if (slot < lineStart + size) {
      if (index === 0) return 'DF';
      return index === lines.length - 1 ? 'FW' : 'MF';
    }
    lineStart += size;
  }
  return null;
}
