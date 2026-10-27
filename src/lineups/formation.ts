import { z } from 'zod';
import { formationSchema } from '@/dataset/formation.js';

// data/curation/formations.json: shapes whose lines differ from their digits
export const formationNamesSchema = z.record(
  z.string().trim().min(1),
  formationSchema,
);
export type FormationNames = z.infer<typeof formationNamesSchema>;

const PREFIX = /^\s*Starting Line-up:\s*/i;
// The leading lines only: `4-4-2 double 6` is 4-4-2
const LINES = /^[0-9](?:-[0-9])+(?=\s|$)/;

// `Starting Line-up: 4-4-2  Diamond` → `4-4-2 Diamond`
export function formationText(raw: string): string {
  return raw.replace(PREFIX, '').split(/\s+/).join(' ').trim();
}

export function toFormation(
  raw: string | null,
  names: FormationNames,
): string | null {
  if (raw === null) return null;
  const text = formationText(raw);
  if (Object.hasOwn(names, text)) return names[text]!;
  const lines = LINES.exec(text)?.[0];
  return lines !== undefined && formationSchema.safeParse(lines).success
    ? lines
    : null;
}
