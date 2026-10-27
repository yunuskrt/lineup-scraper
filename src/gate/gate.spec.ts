import { positionForSlot } from '@/dataset/formation.js';
import {
  failureText,
  gateMatch,
  gateMatches,
  type GateMatch,
  type GatePlayers,
  type GateSide,
} from '@/gate/gate.js';

const FORMATION = '4-4-2';

function side(ids: string[], formation: string | null = FORMATION): GateSide {
  return {
    formation,
    starters: ids.map((transfermarktId, slot) => ({
      position: positionForSlot(FORMATION, slot) ?? 'FW',
      slot,
      transfermarktId,
    })),
  };
}

const HOME = Array.from({ length: 11 }, (_, i) => `h${i}`);
const AWAY = Array.from({ length: 11 }, (_, i) => `a${i}`);
// 22 names no typo confuses
const NAMES = [
  'Alpha',
  'Bravo',
  'Charlie',
  'Delta',
  'Echo',
  'Foxtrot',
  'Golf',
  'Hotel',
  'India',
  'Juliett',
  'Kilo',
  'Lima',
  'Mike',
  'November',
  'Oscar',
  'Papa',
  'Quebec',
  'Romeo',
  'Sierra',
  'Tango',
  'Uniform',
  'Victor',
];

function players(extra: Record<string, string[]> = {}): GatePlayers {
  const aliases = new Map<string, string[]>(
    [...HOME, ...AWAY].map((id, i) => [id, [NAMES[i]]]),
  );
  for (const [id, names] of Object.entries(extra)) aliases.set(id, names);
  return {
    slugs: new Map([...HOME, ...AWAY].map((id) => [id, `p-${id}`])),
    aliases,
  };
}

function match(over: Partial<GateMatch> = {}): GateMatch {
  return {
    slug: '2001-05-23-a-b',
    sides: { home: side(HOME), away: side(AWAY) },
    starPower: { home: 0.55, away: 0.42 },
    ...over,
  };
}

function texts(m: GateMatch, p = players()): string[] {
  return gateMatch(m, p).failures.map(failureText);
}

describe('gateMatch', () => {
  it('passes a clean match with guessability 1 on both sides', () => {
    expect(gateMatch(match(), players())).toEqual({
      failures: [],
      passed: true,
      sides: {
        away: { guessability: 1, starPower: 0.42 },
        home: { guessability: 1, starPower: 0.55 },
      },
      slug: '2001-05-23-a-b',
    });
  });

  it('fails a side with no formation or a broken one', () => {
    expect(
      texts(match({ sides: { home: side(HOME, null), away: side(AWAY) } })),
    ).toEqual(['home: no formation']);
    expect(
      texts(match({ sides: { home: side(HOME), away: side(AWAY, '4-4-1') } })),
    ).toContain('away: formation breaks the schema');
  });

  it('fails a side without 11 starters in 11 slots', () => {
    const ten = side(HOME.slice(0, 10));
    expect(texts(match({ sides: { home: ten, away: side(AWAY) } }))).toEqual([
      'home: 10 starters',
    ]);
    const twice = side(AWAY);
    twice.starters[10] = { ...twice.starters[10], slot: 9 };
    expect(
      texts(match({ sides: { home: side(HOME), away: twice } })),
    ).toContain('away: slots are not 0–10 once each');
  });

  it('fails a player twice in one XI or in both XIs', () => {
    const repeat = side([...HOME.slice(0, 10), 'h0']);
    expect(
      texts(match({ sides: { home: repeat, away: side(AWAY) } })),
    ).toContain('home: a player starts twice');
    const shared = side([...AWAY.slice(0, 10), 'h3']);
    expect(texts(match({ sides: { home: side(HOME), away: shared } }))).toEqual(
      ['match: a player starts for both sides'],
    );
  });

  it('fails a slot whose position breaks the formation', () => {
    const wrong = side(HOME);
    wrong.starters[9] = { ...wrong.starters[9], position: 'MF' };
    expect(texts(match({ sides: { home: wrong, away: side(AWAY) } }))).toEqual([
      'home slot 9: breaks 4-4-2',
    ]);
  });

  it('fails a starter with no player or no alias, by slot', () => {
    const p = players();
    const slugs = new Map(p.slugs);
    slugs.delete('a4');
    const aliases = new Map(p.aliases);
    aliases.delete('h7');
    expect(texts(match(), { slugs, aliases })).toEqual([
      'home slot 7: no alias',
      'away slot 4: no player',
    ]);
  });

  it('fails a starter whose every alias another starter shares (D1)', () => {
    const p = players({ h2: ['Dean Harlow', 'Harlow'], h3: ['Harlow'] });
    const result = gateMatch(match(), p);
    expect(result.failures.map(failureText)).toEqual([
      'home slot 3: no alias of their own',
    ]);
    expect(result.passed).toBe(false);
    expect(result.sides.home.guessability).toBeCloseTo(10 / 11, 4);
  });

  it('counts 0.5 for a starter whose own aliases all have a neighbour', () => {
    const p = players({ h1: ['Pennock'], h2: ['Pennoch'] });
    const result = gateMatch(match(), p);
    expect(result.passed).toBe(true);
    expect(result.sides.home.guessability).toBeCloseTo(10 / 11, 4);
    expect(result.sides.away.guessability).toBe(1);
  });

  it('fails a slot outside 0–10', () => {
    const wide = side(HOME);
    wide.starters[10] = { ...wide.starters[10], slot: 11 };
    expect(texts(match({ sides: { home: wide, away: side(AWAY) } }))).toEqual([
      'home: slots are not 0–10 once each',
      'home slot 11: breaks 4-4-2',
    ]);
  });

  it('fails a scored match with no lineup on both sides', () => {
    const empty: GateSide = { formation: null, starters: [] };
    const result = gateMatch(
      match({ sides: { home: empty, away: empty } }),
      players(),
    );
    expect(result.failures.map(failureText)).toEqual([
      'home: no formation',
      'home: 0 starters',
      'away: no formation',
      'away: 0 starters',
    ]);
    expect(result.sides.home.guessability).toBe(0);
  });

  it('counts 1 when one own alias is clean beside a neighbour', () => {
    const p = players({ h1: ['Pennock', 'Stuart Pennock'], h2: ['Pennoch'] });
    const result = gateMatch(match(), p);
    // h1 has a clean alias; h2's only one has a neighbour
    expect(result.sides.home.guessability).toBeCloseTo(10.5 / 11, 4);
  });

  it('counts 0 for a starter with no alias', () => {
    const p = players();
    const aliases = new Map(p.aliases);
    aliases.delete('a0');
    const result = gateMatch(match(), { ...p, aliases });
    expect(result.sides.away.guessability).toBeCloseTo(10 / 11, 4);
    expect(result.sides.home.guessability).toBe(1);
  });

  it('stops the run on a sides block the backend would neutralise', () => {
    expect(() =>
      gateMatch(match({ starPower: { home: 1.2, away: 0.4 } }), players()),
    ).toThrow('2001-05-23-a-b: sides block fails the backend schema');
  });

  it('sorts by slug and repeats exactly', () => {
    const input = [match({ slug: 'z' }), match({ slug: 'a' })];
    const first = gateMatches(input, players());
    expect(first.map((r) => r.slug)).toEqual(['a', 'z']);
    expect(JSON.stringify(gateMatches(input, players()))).toBe(
      JSON.stringify(first),
    );
    expect(Object.keys(first[0])).toEqual(Object.keys(first[0]).toSorted());
  });
});
