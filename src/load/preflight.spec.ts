import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sha256 } from '@/dataset/files.js';
import type { DatasetInput } from '@/dataset/schema.js';
import { writeDataset } from '@/dataset/write.js';
import { preflight } from '@/load/preflight.js';

const SCHEMA = 'model Club {}\n';
const SIDES = {
  home: { guessability: 1, starPower: 0.5 },
  away: { guessability: 1, starPower: 0.5 },
};

function team(prefix: string) {
  return {
    formation: '4-4-2',
    lineup: Array.from({ length: 11 }, (_, slot) => ({
      playerSlug: `${prefix}-${slot}`,
      slot,
      position: slot === 0 ? 'GK' : slot <= 4 ? 'DF' : slot <= 8 ? 'MF' : 'FW',
    })),
  } as DatasetInput['matches'][number]['home'];
}

const DATASET: DatasetInput = {
  competitions: [{ slug: 'super-lig', kind: 'league', name: 'Süper Lig' }],
  clubs: ['fenerbahce', 'galatasaray'].map((slug) => ({
    slug,
    kind: 'club',
    name: slug,
    shortName: slug.slice(0, 3).toUpperCase(),
    crestKey: null,
    transfermarktId: null,
    aliases: [],
  })),
  players: ['h', 'a'].flatMap((prefix) =>
    Array.from({ length: 11 }, (_, slot) => ({
      slug: `${prefix}-${slot}`,
      name: `Player ${prefix}${slot}`,
      imageKey: null,
      transfermarktId: null,
      aliases: [`Player ${prefix}${slot}`],
    })),
  ),
  matches: [
    {
      slug: '2002-11-06-fenerbahce-galatasaray',
      transfermarktId: '1118844',
      competitionSlug: 'super-lig',
      season: '2002-03',
      date: '2002-11-06',
      stage: 'Matchday 12',
      nickname: null,
      homeClubSlug: 'fenerbahce',
      awayClubSlug: 'galatasaray',
      score: { home: 6, away: 0 },
      extraTime: false,
      shootout: null,
      home: team('h'),
      away: team('a'),
      events: [],
      memorability: {
        score: 65,
        signals: { sides: SIDES },
        algorithmVersion: 's10-v1',
        computedAt: '2026-10-27T14:57:30Z',
      },
    },
  ],
};

describe('preflight', () => {
  let root: string;
  let dir: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'preflight-'));
    dir = path.join(root, 'dataset');
    expect(writeDataset(dir, DATASET, sha256(SCHEMA)).success).toBe(true);
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('passes a fresh build and returns the dataset', () => {
    const result = preflight(dir, SCHEMA);
    expect(result.success).toBe(true);
    expect(result.success && result.dataset.matches).toHaveLength(1);
  });

  it('refuses a dataset built for another schema', () => {
    expect(preflight(dir, 'model Other {}\n')).toEqual({
      success: false,
      error: expect.stringContaining('another schema.prisma'),
    });
  });

  it('refuses a file edited since the build, naming it', () => {
    const file = path.join(dir, 'players.json');
    writeFileSync(
      file,
      readFileSync(file, 'utf8').replace('Player h0', 'Someone'),
    );
    const result = preflight(dir, SCHEMA);
    expect(result).toEqual({
      success: false,
      error: expect.stringContaining('players.json changed'),
    });
    expect(result.success ? '' : result.error).not.toContain('Someone');
  });

  it('refuses a file the manifest lists but the folder lacks', () => {
    unlinkSync(path.join(dir, 'clubs.json'));
    expect(preflight(dir, SCHEMA)).toEqual({
      success: false,
      error: 'Missing clubs.json',
    });
  });

  it('refuses a match file the manifest does not list', () => {
    mkdirSync(path.join(dir, 'matches', 'serie-a'), { recursive: true });
    writeFileSync(path.join(dir, 'matches', 'serie-a', '2000-01.json'), '[]\n');
    expect(preflight(dir, SCHEMA)).toEqual({
      success: false,
      error: 'Not in the manifest: matches/serie-a/2000-01.json',
    });
  });

  it('refuses a folder with no manifest', () => {
    unlinkSync(path.join(dir, 'manifest.json'));
    expect(preflight(dir, SCHEMA).success).toBe(false);
  });
});
