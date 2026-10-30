import { z } from 'zod';
import { parseCsv } from '@/dashboard/csv.js';

export const LINK_TYPES = [
  'Fixture',
  'Match Report',
  'Player',
  'Crest',
  'PlayerPhoto',
] as const;
export type LinkType = (typeof LINK_TYPES)[number];

export const STATUSES = [
  'to save',
  'saved',
  'parsed',
  'validated',
  'uploaded',
  'ingested',
] as const;

const GENERAL_HEADER = ['#', 'Type', 'Link', 'Save as', 'Folder', 'Status'];

const statusSchema = z.union([
  z.enum(STATUSES),
  z.string().regex(/^error: .+$/),
]);

const rowSchema = z.tuple([
  z.string().regex(/^[1-9][0-9]*$/),
  z.enum(LINK_TYPES),
  z.url({ protocol: /^https$/ }),
  z.string().min(1),
  z.string().min(1),
  statusSchema,
]);

export interface LinkRow {
  index: number;
  type: LinkType;
  link: string;
  saveAs: string;
  status: string;
  // Transfermarkt id; CODE-saison for a listing
  key: string;
}

export type ParseResult =
  { success: true; rows: LinkRow[] } | { success: false; error: string };

const KEY_PATTERNS: Record<LinkType, RegExp> = {
  Fixture: /wettbewerb\/([A-Z0-9]+)(?:\?saison_id=|\/saison_id\/)(\d+)$/,
  'Match Report': /\/spielbericht\/(\d+)$/,
  Player: /\/spieler\/(\d+)$/,
  Crest: /\/wappen\/[a-z]+\/(\d+)[_.]/,
  // 206-1464084738.jpg or s_7573_123_2012_1.jpg
  PlayerPhoto: /\/portrait\/[a-z]+\/(?:(\d+)[-.]|s_(\d+)_)/,
};

// null when the link has no id where expected
export function linkKey(type: LinkType, link: string): string | null {
  const match = KEY_PATTERNS[type].exec(link);
  if (!match) return null;
  return match
    .slice(1)
    .filter((part) => part !== undefined)
    .join('-');
}

export function isError(status: string): boolean {
  return status.startsWith('error: ');
}

// Errors name the row and the column, never a value
export function parseGeneral(text: string): ParseResult {
  const [header, ...lines] = parseCsv(text);
  if (header?.join(',') !== GENERAL_HEADER.join(',')) {
    return { success: false, error: 'general.csv: unexpected header' };
  }
  const rows: LinkRow[] = [];
  for (const [at, cells] of lines.entries()) {
    const parsed = rowSchema.safeParse(cells);
    const line = at + 2;
    if (!parsed.success) {
      const column = parsed.error.issues[0]?.path[0];
      const name = typeof column === 'number' ? GENERAL_HEADER[column] : '';
      return {
        success: false,
        error: `general.csv line ${line}: invalid ${name || 'row'}`,
      };
    }
    const [index, type, link, saveAs, , status] = parsed.data;
    const key = linkKey(type, link);
    if (key === null) {
      return { success: false, error: `general.csv line ${line}: no id` };
    }
    rows.push({ index: Number(index), type, link, saveAs, status, key });
  }
  return { success: true, rows };
}
