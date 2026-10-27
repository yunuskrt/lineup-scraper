import type { LineupEvent } from '@/lineups/events.js';
import {
  dramaParts,
  dramaSignal,
  readCaps,
  rivalrySignal,
  sideStarPower,
  stageSignal,
  type MatchFacts,
} from '@/score/signals.js';

function goal(
  side: 'home' | 'away',
  minute: number | null,
  player: string | null = null,
  kind: LineupEvent['kind'] = 'goal',
): LineupEvent {
  return { addedTime: null, kind, minute, player, side };
}

function facts(over: Partial<MatchFacts> = {}): MatchFacts {
  return {
    goals: { home: 0, away: 0 },
    halfTime: null,
    extraTime: false,
    shootout: null,
    events: [],
    ...over,
  };
}

describe('stageSignal', () => {
  it.each<[string | null, number]>([
    ['Final', 1],
    ['Semi-final', 0.8],
    ['Quarter-final', 0.6],
    ['Round of 16', 0.5],
    ['Third-place play-off', 0.4],
    ['Group B', 0.3],
    ['Matchday 12', 0.2],
    [null, 0.2],
  ])('weighs %s at %d', (stage, weight) => {
    expect(stageSignal(stage)).toBe(weight);
  });
});

describe('rivalrySignal', () => {
  it('ranks a derby over a clash over anything else', () => {
    expect(rivalrySignal(['ucl-knockouts', 'derbies'])).toBe(1);
    expect(rivalrySignal(['clashes'])).toBe(0.5);
    expect(rivalrySignal(['world-cup-knockouts'])).toBe(0);
  });
});

describe('dramaParts', () => {
  it('counts a comeback when the side behind at half time does not lose', () => {
    const drew = facts({
      goals: { home: 1, away: 1 },
      halfTime: { home: 0, away: 1 },
    });
    const held = facts({
      goals: { home: 0, away: 2 },
      halfTime: { home: 0, away: 1 },
    });
    expect(dramaParts(drew).comebackFromHt).toBe(true);
    expect(dramaParts(held).comebackFromHt).toBe(false);
    expect(
      dramaParts(facts({ halfTime: { home: 0, away: 0 } })).comebackFromHt,
    ).toBe(false);
  });

  it('finds a winner at 90 or later, extra time included', () => {
    const late = facts({
      goals: { home: 2, away: 1 },
      events: [goal('away', 10), goal('home', 60), goal('home', 90)],
    });
    const extra = facts({
      goals: { home: 1, away: 2 },
      extraTime: true,
      events: [goal('home', 30), goal('away', 75), goal('away', 112)],
    });
    expect(dramaParts(late).lateWinner).toBe(true);
    expect(dramaParts(extra).lateWinner).toBe(true);
  });

  it('times the winner by its last go-ahead goal', () => {
    // Ahead at 10, caught at 80, ahead for good at 89
    const early = facts({
      goals: { home: 2, away: 1 },
      events: [goal('home', 10), goal('away', 80), goal('home', 89)],
    });
    // Ahead at 10, caught at 88, ahead for good at 90+2
    const late = facts({
      goals: { home: 2, away: 1 },
      events: [
        goal('home', 10),
        goal('away', 88),
        { ...goal('home', 90), addedTime: 2 },
      ],
    });
    expect(dramaParts(early).lateWinner).toBe(false);
    expect(dramaParts(late).lateWinner).toBe(true);
  });

  it('counts an own goal for the side it is credited to', () => {
    const own = facts({
      goals: { home: 1, away: 0 },
      events: [goal('home', 94, '8', 'own_goal')],
    });
    expect(dramaParts(own).lateWinner).toBe(true);
  });

  it('ignores a late goal that only adds to a lead', () => {
    const padded = facts({
      goals: { home: 2, away: 0 },
      events: [goal('home', 20), goal('home', 93)],
    });
    expect(dramaParts(padded).lateWinner).toBe(false);
  });

  it('refuses a late winner when goals are missing their minute', () => {
    const unsure = facts({
      goals: { home: 2, away: 1 },
      events: [goal('away', 10), goal('home', null), goal('home', 91)],
    });
    expect(dramaParts(unsure).lateWinner).toBe(false);
  });

  it('counts a hat-trick without own goals, and red cards', () => {
    const own = facts({
      events: [
        goal('home', 10, '7'),
        goal('home', 20, '7', 'penalty_goal'),
        goal('home', 30, '7', 'own_goal'),
        { ...goal('away', 40, '8'), kind: 'red_card' },
      ],
    });
    const three = facts({
      events: [
        goal('home', 10, '7'),
        goal('home', 20, '7'),
        goal('home', 30, '7'),
      ],
    });
    expect(dramaParts(own)).toMatchObject({ hatTrick: false, redCards: 1 });
    expect(dramaParts(three).hatTrick).toBe(true);
  });
});

describe('dramaSignal', () => {
  it('caps goals at 6 and red cards at 2', () => {
    const base = dramaParts(facts());
    const at = (goals: number, redCards: number) =>
      dramaSignal({ ...base, goals, redCards });
    expect(at(6, 2)).toBe(at(11, 5));
    expect(at(3, 1)).toBeCloseTo(0.25 / 2 + 0.1 / 2);
  });

  it('is 0 for a goalless, clean match and 1 at every maximum', () => {
    expect(dramaSignal(dramaParts(facts()))).toBe(0);
    expect(
      dramaSignal({
        comebackFromHt: true,
        extraTime: true,
        goals: 9,
        hatTrick: true,
        lateWinner: true,
        redCards: 4,
        shootout: true,
      }),
    ).toBeCloseTo(1);
  });
});

describe('star power', () => {
  it('reads caps from the header text', () => {
    expect(readCaps('86 / 0')).toBe(86);
    expect(readCaps('123 / 51')).toBe(123);
    expect(readCaps(null)).toBe(0);
    expect(readCaps('-')).toBe(0);
  });

  it('averages the XI with caps capped at 100, missing pages at 0', () => {
    const caps = new Map([
      ['1', 150],
      ['2', 50],
    ]);
    const xi = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
    expect(sideStarPower(xi, caps)).toBeCloseTo(1.5 / 11);
  });
});
