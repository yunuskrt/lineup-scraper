import { breakdown, eraLabel, progressOf, rank } from '@/dashboard/progress.js';
import { entry } from '@/dashboard/spec-fixtures.js';

describe('rank', () => {
  it('places each status on its ladder', () => {
    expect(rank('Match Report', 'to save')).toBe(0);
    expect(rank('Match Report', 'ingested')).toBe(4);
    expect(rank('Crest', 'uploaded')).toBe(2);
    expect(rank('Fixture', 'parsed')).toBe(2);
    expect(rank('Player', 'error: gate: x')).toBe(-1);
  });
});

describe('progressOf', () => {
  it('counts each step cumulatively and errors apart', () => {
    const entries = [
      entry('Match Report', 'to save'),
      entry('Match Report', 'saved'),
      entry('Match Report', 'validated'),
      entry('Match Report', 'ingested'),
      entry('Match Report', 'error: gate: home slot 4: no alias'),
    ];
    expect(progressOf(entries)).toEqual([
      {
        type: 'Match Report',
        total: 5,
        errors: 1,
        steps: [
          { step: 'saved', count: 3 },
          { step: 'parsed', count: 2 },
          { step: 'validated', count: 2 },
          { step: 'ingested', count: 1 },
        ],
      },
    ]);
  });

  it('gives image ladders their own steps', () => {
    const [crest] = progressOf([entry('Crest', 'uploaded')]);
    expect(crest?.steps.map((s) => s.step)).toEqual([
      'saved',
      'uploaded',
      'ingested',
    ]);
  });
});

describe('breakdown', () => {
  it('counts a match once per group, in group order', () => {
    const rows = breakdown(
      [
        entry('Match Report', 'saved', { groups: ['clashes', 'derbies'] }),
        entry('Match Report', 'saved', { groups: ['derbies'] }),
      ],
      'group',
    );
    expect(rows.map((r) => [r.key, r.types[0]?.total])).toEqual([
      ['derbies', 2],
      ['clashes', 1],
    ]);
  });

  it('counts a match under both curated clubs, and only those', () => {
    const rows = breakdown(
      [entry('Match Report', 'saved', { clubs: ['36', '141'] })],
      'club',
      new Set(['36', '141']),
    );
    expect(rows.map((r) => r.key)).toEqual(['141', '36']);
    expect(breakdown([entry('Player', 'saved')], 'club', new Set())).toEqual(
      [],
    );
  });

  it('labels eras and skips entries with no season', () => {
    const rows = breakdown(
      [
        entry('Fixture', 'parsed', { era: 2 }),
        entry('Crest', 'saved', { era: null }),
      ],
      'era',
    );
    expect(rows.map((r) => r.key)).toEqual(['2016–26']);
    expect(eraLabel(0)).toBe('2000–07');
  });
});
