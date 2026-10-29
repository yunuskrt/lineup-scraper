import {
  buildDataset,
  type DatasetSources,
  type SourceLineup,
  type SourceSide,
} from '@/dataset/build.js';
import { datasetFiles } from '@/dataset/files.js';
import { positionForSlot } from '@/dataset/formation.js';
import { datasetSchema } from '@/dataset/schema.js';
import type { ResolvedMatch } from '@/resolve/resolve.js';

const FORMATION = '4-4-2';
const ids = (prefix: string) =>
  Array.from({ length: 11 }, (_, i) => `${prefix}${i + 1}`);

function side(prefix: string, goals: number): SourceSide {
  return {
    formation: FORMATION,
    goals,
    starters: ids(prefix).map((transfermarktId, slot) => ({
      position: positionForSlot(FORMATION, slot) ?? 'GK',
      slot,
      transfermarktId,
    })),
  };
}

function resolved(slug: string, home: string, away: string): ResolvedMatch {
  return {
    away,
    competition: 'super-lig',
    date: '2002-11-06',
    groups: ['derbies'],
    home,
    season: '2002-03',
    slug,
    stage: 'Matchday 12',
    transfermarktId: slug.replace(/\D/g, '').slice(0, 7) || '1',
  };
}

const LINEUP: SourceLineup = {
  events: [
    { addedTime: null, kind: 'goal', minute: 9, player: '1', side: 'home' },
    { addedTime: null, kind: 'goal', minute: 78, player: '999', side: 'home' },
    { addedTime: null, kind: 'goal', minute: 80, player: '500', side: 'home' },
    {
      addedTime: null,
      kind: 'red_card',
      minute: null,
      player: '2',
      side: 'away',
    },
  ],
  extraTime: false,
  shootout: null,
  sides: { home: side('', 3), away: side('2', 0) },
};

const SIDES = {
  away: { guessability: 1, starPower: 0.35 },
  home: { guessability: 0.9545, starPower: 0.48 },
};

function sources(): DatasetSources {
  const playerIds = [...ids(''), ...ids('2'), '500', '600', '700'];
  return {
    competitions: [
      { slug: 'super-lig', kind: 'league', name: 'Süper Lig' },
      { slug: 'world-cup', kind: 'world_cup', name: 'World Cup' },
    ],
    clubs: ['fenerbahce', 'galatasaray', 'besiktas'].map((slug, i) => ({
      aliases: [],
      kind: 'club',
      name: slug,
      shortName: slug.slice(0, 3).toUpperCase(),
      slug,
      transfermarktId: String(36 + i),
    })),
    matches: [
      resolved(
        '2002-11-06-fenerbahce-galatasaray',
        'fenerbahce',
        'galatasaray',
      ),
      resolved('2003-02-02-fenerbahce-besiktas', 'fenerbahce', 'besiktas'),
      resolved('2003-03-08-galatasaray-besiktas', 'galatasaray', 'besiktas'),
      resolved('2003-04-20-besiktas-fenerbahce', 'besiktas', 'fenerbahce'),
    ],
    players: new Map(
      playerIds.map((id) => [
        id,
        { name: `Player ${id}`, slug: `player-${id}`, transfermarktId: id },
      ]),
    ),
    aliases: new Map(playerIds.map((id) => [id, [`Player ${id}`]])),
    lineups: new Map([
      ['2002-11-06-fenerbahce-galatasaray', LINEUP],
      ['2003-02-02-fenerbahce-besiktas', LINEUP],
      ['2003-03-08-galatasaray-besiktas', LINEUP],
    ]),
    scores: new Map(
      [
        '2002-11-06-fenerbahce-galatasaray',
        '2003-02-02-fenerbahce-besiktas',
      ].map((slug) => [
        slug,
        {
          algorithmVersion: 's10-v1',
          computedAt: '2026-10-27T14:57:30Z',
          score: 65,
          signals: { stage: 0.2, sides: { home: { starPower: 0.48 } } },
        },
      ]),
    ),
    gate: new Map([
      ['2002-11-06-fenerbahce-galatasaray', { passed: true, sides: SIDES }],
      ['2003-02-02-fenerbahce-besiktas', { passed: false, sides: SIDES }],
    ]),
  };
}

describe('buildDataset', () => {
  const build = buildDataset(sources());
  const [match] = build.dataset.matches;

  it('keeps only matches that passed the gate, and says why the rest left', () => {
    expect(build.dataset.matches.map((m) => m.slug)).toEqual([
      '2002-11-06-fenerbahce-galatasaray',
    ]);
    expect(build.left).toEqual([
      { slug: '2003-02-02-fenerbahce-besiktas', reason: 'failed the gate' },
      { slug: '2003-03-08-galatasaray-besiktas', reason: 'not scored' },
      { slug: '2003-04-20-besiktas-fenerbahce', reason: 'no lineup' },
    ]);
  });

  it('takes only the competitions, clubs and players it uses', () => {
    expect(build.dataset.competitions.map((c) => c.slug)).toEqual([
      'super-lig',
    ]);
    expect(build.dataset.clubs.map((c) => c.slug)).toEqual([
      'fenerbahce',
      'galatasaray',
    ]);
    const slugs = build.dataset.players.map((p) => p.slug);
    expect(slugs).toHaveLength(23);
    expect(slugs).toContain('player-500');
    expect(slugs).not.toContain('player-600');
    expect(build.eventOnly).toEqual(['player-500']);
  });

  it('maps events to slugs, an unknown player to null, and drops no minute', () => {
    expect(match.events.map((e) => [e.minute, e.playerSlug])).toEqual([
      [9, 'player-1'],
      [78, null],
      [80, 'player-500'],
    ]);
    expect(build.droppedEvents).toEqual([
      { slug: '2002-11-06-fenerbahce-galatasaray', count: 1 },
    ]);
  });

  it('puts the gate sides block into the signals', () => {
    expect(match.memorability).toEqual({
      score: 65,
      signals: { stage: 0.2, sides: SIDES },
      algorithmVersion: 's10-v1',
      computedAt: '2026-10-27T14:57:30Z',
    });
  });

  it('builds what the dataset schema accepts, ids included', () => {
    expect(datasetSchema.safeParse(build.dataset).success).toBe(true);
    expect(match.transfermarktId).toBe('2002110');
    expect(match.home.lineup[0]).toEqual({
      playerSlug: 'player-1',
      slot: 0,
      position: 'GK',
    });
    expect(build.dataset.clubs[0].transfermarktId).toBe('36');
  });

  it('fails the schema, naming a path, when a starter has no player', () => {
    const broken = sources();
    broken.players.delete('5');
    const result = datasetSchema.safeParse(buildDataset(broken).dataset);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path.join('.'))).toContain(
      'matches.0.home.lineup.4.playerSlug',
    );
  });

  it('carries extra time and the shootout, home first', () => {
    const input = sources();
    input.lineups.set('2002-11-06-fenerbahce-galatasaray', {
      ...LINEUP,
      extraTime: true,
      shootout: { away: 3, home: 5 },
    });
    const [final] = buildDataset(input).dataset.matches;
    expect(final.extraTime).toBe(true);
    expect(final.shootout).toEqual({ home: 5, away: 3 });
    expect(Object.keys(final.shootout!)).toEqual(['home', 'away']);
    expect(final.score).toEqual({ home: 3, away: 0 });
  });

  it('fills crest and image keys by slug, null without one', () => {
    const keyed = buildDataset({
      ...sources(),
      crestKeys: new Map([['fenerbahce', 'crests/fenerbahce/1.webp']]),
      imageKeys: new Map([['player-1', 'players/player-1/2.webp']]),
    }).dataset;
    const crests = keyed.clubs.map((c) => [c.slug, c.crestKey]);
    expect(crests).toEqual([
      ['fenerbahce', 'crests/fenerbahce/1.webp'],
      ['galatasaray', null],
    ]);
    const kahn = keyed.players.find((p) => p.slug === 'player-1');
    expect(kahn?.imageKey).toBe('players/player-1/2.webp');
    const manifest = JSON.parse(datasetFiles(keyed, 'h').get('manifest.json')!);
    expect([manifest.counts.crests, manifest.counts.photos]).toEqual([1, 1]);
  });

  it('repeats exactly', () => {
    const again = buildDataset(sources());
    expect(JSON.stringify(again)).toBe(JSON.stringify(build));
    expect([...datasetFiles(again.dataset, 'h')]).toEqual([
      ...datasetFiles(build.dataset, 'h'),
    ]);
  });
});
