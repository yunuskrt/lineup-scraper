import { readFileSync } from 'node:fs';
import { renderSchema } from '@/raw/schema-files.js';
import {
  remoteStatus,
  remoteStatusSchema,
  type RemoteInput,
} from '@/status/remote.js';
import { REMOTE_STATUS_SCHEMA_FILE } from '@/status/schema-file.js';

const KEYS = {
  crests: [
    {
      key: 'crests/valencia/a.webp',
      slug: 'valencia',
      transfermarktId: '1049',
    },
    { key: 'crests/bayern/b.webp', slug: 'bayern', transfermarktId: '27' },
  ],
  photos: [
    {
      key: 'players/oliver-kahn/c.webp',
      slug: 'oliver-kahn',
      transfermarktId: '206',
    },
  ],
};

function input(changes: Partial<RemoteInput> = {}): RemoteInput {
  return {
    dataset: { matches: ['990248', '53491'], players: ['206', '11'] },
    gate: [],
    keys: KEYS,
    bucket: null,
    database: null,
    notes: [],
    ...changes,
  };
}

describe('remoteStatus', () => {
  it('validates the dataset ids, sorted as numbers', () => {
    const status = remoteStatus(input());

    expect(status.validated).toEqual({
      match: ['53491', '990248'],
      player: ['11', '206'],
    });
    expect(remoteStatusSchema.parse(status)).toEqual(status);
  });

  it('leaves the bucket and the database unchecked, with the notes', () => {
    const status = remoteStatus(
      input({ dataset: null, notes: ['database not checked: no .env'] }),
    );

    expect(status.uploaded).toBeNull();
    expect(status.ingested).toBeNull();
    expect(status.validated).toEqual({ match: [], player: [] });
    expect(status.notes).toEqual(['database not checked: no .env']);
  });

  it('turns a gate failure into an error, but not a missing player page', () => {
    const status = remoteStatus(
      input({
        gate: [
          {
            transfermarktId: '2',
            failures: [
              { at: 'home slot 4', rule: 'no alias of their own' },
              { at: 'away', rule: 'no formation' },
            ],
          },
          {
            transfermarktId: '3',
            failures: [
              { at: 'away slot 2', rule: 'no player' },
              { at: 'away slot 2', rule: 'no alias' },
            ],
          },
          { transfermarktId: '4', failures: [] },
        ],
      }),
    );

    expect(status.errors.match).toEqual({
      '2': 'gate: home slot 4: no alias of their own (+1 more)',
    });
  });

  it('marks an image uploaded only when its current key is in the bucket', () => {
    const status = remoteStatus(
      input({
        bucket: new Set(['crests/valencia/a.webp', 'crests/bayern/old.webp']),
      }),
    );

    expect(status.uploaded).toEqual({ crest: ['1049'], photo: [] });
  });

  it('marks rows ingested, and images only when the row holds the key', () => {
    const status = remoteStatus(
      input({
        database: {
          matches: ['990248'],
          players: ['206'],
          crestKeys: new Map([
            ['27', 'crests/bayern/b.webp'],
            ['1049', 'crests/valencia/old.webp'],
          ]),
          photoKeys: new Map([['206', null]]),
        },
      }),
    );

    expect(status.ingested).toEqual({
      match: ['990248'],
      player: ['206'],
      crest: ['27'],
      photo: [],
    });
  });

  it('schemas/work/status-remote.schema.json is current (run `npm run schemas`)', () => {
    expect(readFileSync(REMOTE_STATUS_SCHEMA_FILE, 'utf8')).toBe(
      renderSchema(remoteStatusSchema),
    );
  });
});
