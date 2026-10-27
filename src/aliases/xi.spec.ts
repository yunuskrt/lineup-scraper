import { FUZZY_THRESHOLD, similarity } from '@/aliases/similarity.js';
import { checkXis, type PlayerAliases } from '@/aliases/xi.js';

const ALIASES = new Map<string, PlayerAliases>([
  ['1', { slug: 'dean-harlow', aliases: ['Dean Harlow', 'Harlow'] }],
  ['2', { slug: 'rhys-harlow', aliases: ['Rhys Harlow', 'Harlow'] }],
  ['3', { slug: 'harlow', aliases: ['Harlow'] }],
  ['4', { slug: 'stuart-pennock', aliases: ['Stuart Pennock', 'Pennock'] }],
  ['5', { slug: 'ian-pennoch', aliases: ['Ian Pennoch', 'Pennoch'] }],
  ['6', { slug: 'xavi', aliases: ['Xavi'] }],
  ['7', { slug: 'xabi', aliases: ['Xabi'] }],
]);

function xi(starters: string[]) {
  return { match: '2001-05-23-a-b', side: 'home' as const, starters };
}

describe('checkXis', () => {
  it('finds an alias two starters share, on the normalised form', () => {
    const findings = checkXis([xi(['1', '2', '6'])], ALIASES);
    expect(findings.shared).toEqual([
      {
        match: '2001-05-23-a-b',
        side: 'home',
        alias: 'harlow',
        players: ['dean-harlow', 'rhys-harlow'],
      },
    ]);
    expect(findings.unrevealable).toEqual([]);
  });

  it('reports a starter with no alias of their own', () => {
    const findings = checkXis([xi(['1', '3'])], ALIASES);
    expect(findings.unrevealable).toEqual([
      { match: '2001-05-23-a-b', side: 'home', player: 'harlow' },
    ]);
  });

  it('finds fuzzy neighbours above the threshold only', () => {
    const findings = checkXis([xi(['4', '5', '6', '7'])], ALIASES);
    // Pennock clears 0.82; Xavi/Xabi (0.75) doesn't
    expect(
      findings.fuzzy.map((f) => [f.aliases, f.players, f.score.toFixed(3)]),
    ).toEqual([
      [['pennock', 'pennoch'], ['stuart-pennock', 'ian-pennoch'], '0.857'],
    ]);
    expect(findings.shared).toEqual([]);
  });

  it('still scores names one letter longer, and skips far longer ones', () => {
    const aliases = new Map<string, PlayerAliases>([
      ['1', { slug: 'a', aliases: ['Harlow'] }],
      ['2', { slug: 'b', aliases: ['Harlowe'] }],
      ['3', { slug: 'c', aliases: ['Harlowezz'] }],
    ]);
    const findings = checkXis([xi(['1', '2', '3'])], aliases);
    // Two letters longer is 0.78 at best: skipped
    expect(findings.fuzzy.map((f) => f.players)).toEqual([['a', 'b']]);
  });

  it('finds the same neighbours as scoring every pair', () => {
    const names = [
      'harlow',
      'harlowe',
      'harlo',
      'harlowezz',
      'pennock',
      'pennoch',
      'pennockk',
      'pennoc',
      'ronaldo',
      'ronaldinho',
      'abcdefghijk',
      'abcdefghij',
      'abcdefghi',
    ];
    const aliases = new Map(
      names.map((name, i) => [String(i), { slug: name, aliases: [name] }]),
    );
    const starters = names.map((_, i) => String(i));
    const expected = names.flatMap((a, i) =>
      names
        .slice(i + 1)
        .filter((b) => similarity(a, b) > FUZZY_THRESHOLD)
        .map((b) => [a, b]),
    );
    const found = checkXis([xi(starters)], aliases).fuzzy.map((f) => f.aliases);
    expect(found).toEqual(expected);
    expect(found.length).toBeGreaterThan(5);
  });

  it('lists starters with no alias set by spieler id', () => {
    const findings = checkXis(
      [xi(['6', '99']), { ...xi(['7']), side: 'away' as const }],
      ALIASES,
    );
    expect(findings.missing).toEqual([
      { match: '2001-05-23-a-b', side: 'home', player: '99' },
    ]);
  });
});
