import { z } from 'zod';

export const SIZE = 128;

// Where a tall photo's square is cut from
export const cropSchema = z.union([
  z.enum(['top', 'centre', 'bottom']),
  // Pixels from the top of the source
  z.number().int().nonnegative(),
]);

export type Crop = z.infer<typeof cropSchema>;

// Fits Transfermarkt's 139×181 framing (pilot)
export const DEFAULT_CROP: Crop = 'centre';

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

// The largest square; tall sources by `crop`
export function cropBox(width: number, height: number, crop: Crop): Box {
  const side = Math.min(width, height);
  const spare = height - side;
  const left = Math.floor((width - side) / 2);
  let top = 0;
  if (crop === 'centre') top = Math.floor(spare / 2);
  else if (crop === 'bottom') top = spare;
  else if (typeof crop === 'number') top = Math.min(crop, spare);
  return { left, top, width: side, height: side };
}
