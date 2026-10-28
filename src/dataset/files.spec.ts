import { datasetFiles, MANIFEST, sha256 } from '@/dataset/files.js';
import type { DatasetInput } from '@/dataset/schema.js';

type Match = DatasetInput['matches'][number];

function match(slug: string, competitionSlug: string, season: string): Match {
  return {
    slug,
    transfermarktId: null,
    competitionSlug,
    season,
    date: '2001-05-23',
    stage: null,
    nickname: null,
    homeClubSlug: 'a',
    awayClubSlug: 'b',
    score: { home: 1, away: 0 },
    extraTime: false,
    shootout: null,
    home: { formation: '4-4-2', lineup: [] },
    away: { formation: '4-4-2', lineup: [] },
    events: [],
    memorability: {
      score: 70,
      signals: {
        sides: {
          home: { guessability: 1, starPower: 0.5 },
          away: { guessability: 1, starPower: 0.5 },
        },
      },
      algorithmVersion: 's10-v1',
      computedAt: '2026-10-27T00:00:00Z',
    },
  };
}

const DATASET: DatasetInput = {
  competitions: [],
  clubs: [],
  players: [],
  matches: [
    match('z-final', 'champions-league', '2000-01'),
    match('b-semi', 'champions-league', '2000-01'),
    match('derby', 'super-lig', '2002-03'),
  ],
};

describe('datasetFiles', () => {
  const files = datasetFiles(DATASET, 'schema-hash');

  it('writes one match file per competition season, sorted by slug', () => {
    expect([...files.keys()]).toEqual([
      'competitions.json',
      'clubs.json',
      'players.json',
      'matches/champions-league/2000-01.json',
      'matches/super-lig/2002-03.json',
      MANIFEST,
    ]);
    const cl = JSON.parse(files.get('matches/champions-league/2000-01.json')!);
    expect(cl.map((m: Match) => m.slug)).toEqual(['b-semi', 'z-final']);
  });

  it('ends every file in a newline with 2-space JSON', () => {
    for (const text of files.values()) {
      expect(text.endsWith('\n')).toBe(true);
    }
    expect(files.get('competitions.json')).toBe('[]\n');
    expect(files.get('matches/super-lig/2002-03.json')).toContain(
      '\n  {\n    "slug": "derby"',
    );
  });

  it('hashes every other file into a manifest with no timestamp', () => {
    const manifest = JSON.parse(files.get(MANIFEST)!);
    expect(Object.keys(manifest)).toEqual([
      'algorithmVersions',
      'counts',
      'files',
      'matchesBy',
      'schemaHash',
      'sources',
    ]);
    expect(manifest.files['players.json']).toBe(sha256('[]\n'));
    expect(manifest.files[MANIFEST]).toBeUndefined();
    expect(manifest.matchesBy).toEqual({
      'champions-league/2000-01': 2,
      'super-lig/2002-03': 1,
    });
    expect(manifest.counts.matches).toBe(3);
    expect(manifest.schemaHash).toBe('schema-hash');
    expect(manifest.algorithmVersions).toEqual(['s10-v1']);
  });
});
