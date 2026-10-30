import { z } from 'zod';
import type { ImageKeys } from '@/images/keys.js';

const idsSchema = z.array(z.string().regex(/^[0-9]+$/));

// Known only to the dataset, bucket and database
export const remoteStatusSchema = z.strictObject({
  validated: z.strictObject({ match: idsSchema, player: idsSchema }),
  errors: z.strictObject({ match: z.record(z.string(), z.string()) }),
  // null: not checked, and `notes` says why
  uploaded: z.strictObject({ crest: idsSchema, photo: idsSchema }).nullable(),
  ingested: z
    .strictObject({
      match: idsSchema,
      player: idsSchema,
      crest: idsSchema,
      photo: idsSchema,
    })
    .nullable(),
  notes: z.array(z.string()),
});

export type RemoteStatus = z.infer<typeof remoteStatusSchema>;

export interface GateResult {
  transfermarktId: string;
  failures: { at: string; rule: string }[];
}

export interface StoredRows {
  matches: string[];
  players: string[];
  // Transfermarkt id → stored key
  crestKeys: Map<string, string | null>;
  photoKeys: Map<string, string | null>;
}

export interface RemoteInput {
  dataset: { matches: string[]; players: string[] } | null;
  gate: GateResult[];
  keys: ImageKeys;
  bucket: Set<string> | null;
  database: StoredRows | null;
  notes: string[];
}

// A missing player page means waiting, not an error
const WAITING_RULE = 'no player';

const sorted = (ids: Iterable<string>): string[] =>
  [...new Set(ids)].toSorted(
    (a, b) => Number(a) - Number(b) || (a < b ? -1 : 1),
  );

function gateErrors(gate: GateResult[]): Record<string, string> {
  const errors: [string, string][] = [];
  for (const { transfermarktId, failures } of gate) {
    const [first] = failures;
    if (!first || failures.some((f) => f.rule === WAITING_RULE)) continue;
    const more = failures.length > 1 ? ` (+${failures.length - 1} more)` : '';
    errors.push([transfermarktId, `gate: ${first.at}: ${first.rule}${more}`]);
  }
  return Object.fromEntries(
    errors.toSorted(([a], [b]) => Number(a) - Number(b)),
  );
}

// Ids whose current key is the stored one
function keyed(
  entries: ImageKeys['crests'],
  has: (id: string, key: string) => boolean,
): string[] {
  return sorted(
    entries
      .filter((e) => has(e.transfermarktId, e.key))
      .map((e) => e.transfermarktId),
  );
}

export function remoteStatus(input: RemoteInput): RemoteStatus {
  const { bucket, database, keys } = input;
  return {
    validated: {
      match: sorted(input.dataset?.matches ?? []),
      player: sorted(input.dataset?.players ?? []),
    },
    errors: { match: gateErrors(input.gate) },
    uploaded: bucket && {
      crest: keyed(keys.crests, (_, key) => bucket.has(key)),
      photo: keyed(keys.photos, (_, key) => bucket.has(key)),
    },
    ingested: database && {
      match: sorted(database.matches),
      player: sorted(database.players),
      crest: keyed(
        keys.crests,
        (id, key) => database.crestKeys.get(id) === key,
      ),
      photo: keyed(
        keys.photos,
        (id, key) => database.photoKeys.get(id) === key,
      ),
    },
    notes: input.notes,
  };
}
