import { eraBucket, thresholdFor } from '@/score/pool-rules.js';
import {
  ALGORITHM_VERSION,
  floorFor,
  percentiles,
  scoreMatches,
  type ScoreInput,
} from '@/score/score.js';

const XI = Array.from({ length: 11 }, (_, i) => String(i + 1));

function input(slug: string, over: Partial<ScoreInput> = {}): ScoreInput {
  return {
    slug,
    kind: 'league',
    seasonStart: 2002,
    stage: 'Matchday 12',
    groups: ['clashes'],
    starters: { home: XI, away: XI },
    goals: { home: 0, away: 0 },
    halfTime: { home: 0, away: 0 },
    extraTime: false,
    shootout: null,
    events: [],
    ...over,
  };
}

const AT = '2026-10-27T14:57:30Z';

describe('pool rules', () => {
  it('buckets season start years like the backend', () => {
    expect([2000, 2007, 2008, 2015, 2016, 2025].map(eraBucket)).toEqual([
      0, 0, 1, 1, 2, 2,
    ]);
    expect(eraBucket(1999)).toBeNull();
  });

  it('floors each class 5 above its threshold', () => {
    expect(thresholdFor('ucl')).toBe(45);
    expect(thresholdFor('uel')).toBe(60);
    expect(floorFor('world_cup')).toBe(50);
    expect(floorFor('euro')).toBe(50);
    expect(floorFor('league')).toBe(65);
    expect(floorFor('uel')).toBe(65);
  });
});

describe('percentiles', () => {
  it('ranks from 0 to 1 and shares ties', () => {
    expect(percentiles([0.2, 0.5, 0.9])).toEqual([0, 0.5, 1]);
    expect(percentiles([0.4, 0.4, 0.9, 0.1])).toEqual([0.5, 0.5, 1, 0]);
  });

  it('gives a bucket of one the middle', () => {
    expect(percentiles([0.7])).toEqual([0.5]);
  });
});

describe('scoreMatches', () => {
  it('normalises within each era bucket only', () => {
    const { scores } = scoreMatches(
      [
        input('a', { seasonStart: 2002, stage: 'Final', kind: 'ucl' }),
        input('b', { seasonStart: 2003 }),
        input('c', { seasonStart: 2012 }),
      ],
      new Map(),
      AT,
    );
    const by = new Map(scores.map((s) => [s.slug, s]));
    expect(by.get('a')?.score).toBe(100);
    expect(by.get('b')?.score).toBe(65);
    // Alone in 2008–15
    expect(by.get('c')?.signals.percentile).toBe(0.5);
    expect(by.get('c')?.score).toBe(82.5);
  });

  it('clears every threshold, sorts by slug and repeats exactly', () => {
    const inputs = [
      input('z-dull', { groups: ['clashes'], kind: 'uel' }),
      input('m-final', { stage: 'Final', kind: 'euro', seasonStart: 2004 }),
      input('a-derby', { groups: ['derbies'] }),
    ];
    const first = scoreMatches(inputs, new Map([['1', 90]]), AT);
    expect(first.scores.map((s) => s.slug)).toEqual([
      'a-derby',
      'm-final',
      'z-dull',
    ]);
    for (const s of first.scores) {
      const kind = inputs.find((m) => m.slug === s.slug)!.kind;
      expect(s.score).toBeGreaterThanOrEqual(thresholdFor(kind) + 5);
      expect(s.score).toBeLessThanOrEqual(100);
      expect(s.algorithmVersion).toBe(ALGORITHM_VERSION);
      expect(s.computedAt).toBe(AT);
    }
    expect(JSON.stringify(scoreMatches(inputs, new Map([['1', 90]]), AT))).toBe(
      JSON.stringify(first),
    );
  });

  it('writes star power per side and lists starters without a page', () => {
    const away = XI.map((id) => `9${id}`);
    const { scores, missing } = scoreMatches(
      [input('x', { starters: { home: XI, away } })],
      new Map(XI.map((id) => [id, 55])),
      AT,
    );
    expect(scores[0].signals.sides).toEqual({
      away: { starPower: 0 },
      home: { starPower: 0.55 },
    });
    expect(scores[0].signals.starPower).toBe(0.275);
    expect(missing).toHaveLength(11);
    expect(missing[0]).toEqual({ slug: 'x', side: 'away', player: '91' });
  });

  it('keeps signal keys in alphabetical order', () => {
    const { scores } = scoreMatches([input('x')], new Map(), AT);
    const keys = Object.keys(scores[0].signals);
    expect(keys).toEqual(keys.toSorted());
    expect(Object.keys(scores[0])).toEqual(Object.keys(scores[0]).toSorted());
    const raw = Object.keys(scores[0].signals.raw);
    expect(raw).toEqual(raw.toSorted());
  });

  it('lists a side with no XI, never its starters as missing pages', () => {
    const result = scoreMatches(
      [input('x', { starters: { home: XI, away: [] } })],
      new Map(XI.map((id) => [id, 10])),
      AT,
    );
    expect(result.short).toEqual([{ slug: 'x', side: 'away' }]);
    expect(result.missing).toEqual([]);
    expect(result.scores[0].signals.sides.away.starPower).toBe(0);
  });

  it('refuses a season outside the buckets', () => {
    expect(() =>
      scoreMatches([input('old', { seasonStart: 1998 })], new Map(), AT),
    ).toThrow('old: season outside the era buckets');
  });
});
