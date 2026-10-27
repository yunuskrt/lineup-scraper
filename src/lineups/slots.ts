import { SQUAD_SIZE } from '@/dataset/constants.js';
import type { PositionGroup } from '@/dataset/enums.js';
import { positionForSlot } from '@/dataset/formation.js';

// Transfermarkt draws every keeper at this height
export const KEEPER_TOP = 80;

const TOP = /top:\s*([0-9]+(?:\.[0-9]+)?)%/;
const LEFT = /left:\s*([0-9]+(?:\.[0-9]+)?)%/;

export interface StarterInput {
  sourceId: string;
  style: string;
}

// Keys in alphabetical order: the file's key order
export interface Slotted {
  position: PositionGroup;
  slot: number;
  transfermarktId: string;
}

export type SlotResult =
  { isMapped: true; starters: Slotted[] } | { isMapped: false; reason: string };

interface Placed {
  sourceId: string;
  top: number;
  left: number;
}

function place(starter: StarterInput): Placed | null {
  const top = TOP.exec(starter.style)?.[1];
  const left = LEFT.exec(starter.style)?.[1];
  if (top === undefined || left === undefined) return null;
  return { sourceId: starter.sourceId, top: Number(top), left: Number(left) };
}

function refused(reason: string): SlotResult {
  return { isMapped: false, reason };
}

// Lines by height, chunked by the formation; each line right to left
function splitLines(
  outfield: Placed[],
  formation: string,
): Placed[][] | string {
  const byHeight = outfield.toSorted((a, b) => b.top - a.top);
  const lines: Placed[][] = [];
  let start = 0;
  for (const size of formation.split('-').map(Number)) {
    lines.push(byHeight.slice(start, start + size));
    start += size;
  }
  for (const [index, line] of lines.entries()) {
    const next = lines[index + 1];
    const lowest = Math.min(...line.map((p) => p.top));
    if (next && lowest <= Math.max(...next.map((p) => p.top))) {
      return `lines ${index + 1} and ${index + 2} overlap in height`;
    }
    if (new Set(line.map((p) => p.left)).size !== line.length) {
      return `two starters share a left position in line ${index + 1}`;
    }
  }
  return lines.map((line) => line.toSorted((a, b) => b.left - a.left));
}

export function assignSlots(
  starters: StarterInput[],
  formation: string,
): SlotResult {
  if (starters.length !== SQUAD_SIZE) {
    return refused(`${starters.length} starters, not ${SQUAD_SIZE}`);
  }
  if (new Set(starters.map((s) => s.sourceId)).size !== SQUAD_SIZE) {
    return refused('a player starts twice');
  }
  const placed = starters.map(place);
  if (placed.some((p) => p === null)) {
    return refused('a starter has no top or left');
  }
  const all = placed as Placed[];
  const keepers = all.filter((p) => p.top === KEEPER_TOP);
  if (keepers.length !== 1) return refused(`${keepers.length} keepers`);
  const lines = splitLines(
    all.filter((p) => p.top !== KEEPER_TOP),
    formation,
  );
  if (typeof lines === 'string') return refused(lines);
  const ordered = [keepers[0]!, ...lines.flat()];
  return {
    isMapped: true,
    starters: ordered.map((p, slot) => ({
      position: positionForSlot(formation, slot)!,
      slot,
      transfermarktId: p.sourceId,
    })),
  };
}
