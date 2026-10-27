import { renderReport, type ScoredMatch } from '@/score/report.js';
import { scoreMatches, type ScoreInput } from '@/score/score.js';

const XI = Array.from({ length: 11 }, (_, i) => String(i + 1));

function input(slug: string, over: Partial<ScoreInput>): ScoreInput {
  return {
    slug,
    kind: 'league',
    seasonStart: 2002,
    stage: 'Matchday 3',
    groups: ['clashes'],
    starters: { home: XI, away: XI },
    goals: { home: 1, away: 0 },
    halfTime: null,
    extraTime: false,
    shootout: null,
    events: [],
    ...over,
  };
}

const INPUTS = [
  input('a', { groups: ['derbies'] }),
  input('b', {}),
  input('c', { kind: 'ucl', stage: 'Final', groups: ['ucl-knockouts'] }),
];
const MATCHES: ScoredMatch[] = INPUTS.map(({ slug, kind, groups }) => ({
  slug,
  kind,
  groups,
}));

describe('renderReport', () => {
  const text = renderReport(
    MATCHES,
    scoreMatches(INPUTS, new Map([['1', 40]]), '2026-10-27T00:00:00Z'),
  );

  it('sums up and spreads scores by group with their threshold', () => {
    expect(text).toContain('Matches scored: 3. Below their threshold: 0.');
    expect(text).toContain(
      '`ucl-knockouts`: 1, lowest 100.00, median 100.00, highest 100.00; must clear 45',
    );
    expect(text).toContain('`league`: 2, lowest 65.00, median');
  });

  it('flags a small era bucket and lists starters without a page', () => {
    expect(text).toContain('2000–2007: 3 (small: scores move as it grows)');
    expect(text).toContain('2008–2015: 0\n');
    expect(text).toContain('`a` home: spieler 2');
    expect(text).not.toContain('## Below their threshold');
  });
});
