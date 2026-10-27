import {
  areNeighbours,
  FUZZY_THRESHOLD,
  similarity,
} from '@/aliases/similarity.js';

// From the backend's matcher.spec.ts
describe('similarity', () => {
  it('runs at the backend threshold', () => {
    expect(FUZZY_THRESHOLD).toBe(0.82);
    expect(similarity('ronaldo', 'ronaldinho')).toBeLessThan(FUZZY_THRESHOLD);
  });

  it('is 1 for equal strings, including two empty ones', () => {
    expect(similarity('moss', 'moss')).toBe(1);
    expect(similarity('', '')).toBe(1);
  });

  it('is 0 against an empty string', () => {
    expect(similarity('moss', '')).toBe(0);
    expect(similarity('', 'moss')).toBe(0);
  });

  it.each([
    ['ronaldo', 'ronaldinho'],
    ['pennokc', 'pennock'],
    ['xavi', 'xabi'],
  ])('is symmetric for %s and %s', (a, b) => {
    expect(similarity(a, b)).toBe(similarity(b, a));
  });

  it('counts a swapped pair as one edit', () => {
    expect(similarity('pennokc', 'pennock')).toBeCloseTo(1 - 1 / 7);
  });

  it.each<[string, string, number]>([
    ['ronaldo', 'ronaldinho', 0.7],
    ['harlwo', 'harlow', 1 - 1 / 6],
    ['tollnd', 'tolland', 1 - 1 / 7],
    ['xavi', 'xabi', 0.75],
  ])('scores %s / %s at %d', (a, b, score) => {
    expect(similarity(a, b)).toBeCloseTo(score);
  });
});

describe('areNeighbours', () => {
  it('pairs two different aliases above the threshold', () => {
    expect(areNeighbours('pennock', 'pennoch')).toBe(true);
    expect(areNeighbours('harlow', 'harlowe')).toBe(true);
  });

  it('never pairs an alias with itself, or names too far apart', () => {
    expect(areNeighbours('pennock', 'pennock')).toBe(false);
    expect(areNeighbours('xavi', 'xabi')).toBe(false);
    expect(areNeighbours('harlow', 'harlowezz')).toBe(false);
    expect(areNeighbours('', 'x')).toBe(false);
  });
});
