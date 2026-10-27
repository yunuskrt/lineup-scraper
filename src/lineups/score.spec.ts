import type { LineupEvent } from '@/lineups/events.js';
import { countGoals, halfTime, readMatchScore } from '@/lineups/score.js';
import { event, final2001, kicks } from '@/lineups/spec-fixtures.js';

function goal(side: 'home' | 'away', minute: number | null): LineupEvent {
  return { addedTime: null, kind: 'goal', minute, player: null, side };
}

describe('countGoals', () => {
  it('counts each goal for the side whose running score rises', () => {
    const goals = [
      event('goal', 'home', null, '1:0 A', ['1']),
      // An own goal sits in either box; the score decides
      event('goal', 'home', null, '1:1 B', ['2']),
      event('goal', 'away', null, '+2 2:1 C', ['3'], '+2'),
    ];
    expect(countGoals(goals)).toEqual({
      isCounted: true,
      score: { away: 1, home: 2 },
      sides: ['home', 'away', 'home'],
    });
    expect(countGoals([])).toEqual({
      isCounted: true,
      score: { away: 0, home: 0 },
      sides: [],
    });
  });

  it('refuses a jump or a goal with no running score', () => {
    expect(countGoals([event('goal', 'home', null, '2:0 A', ['1'])])).toEqual({
      isCounted: false,
      reason: 'the running score jumps',
    });
    expect(countGoals([event('goal', 'home', null, 'A', ['1'])])).toEqual({
      isCounted: false,
      reason: 'a goal has no running score',
    });
  });
});

describe('readMatchScore', () => {
  const level = { away: 1, home: 1 };
  const goals = [goal('away', 3), goal('home', 50)];

  it('reads the 2001 final: 1:1, extra time, 5:4 on pens', () => {
    expect(readMatchScore(final2001(), level, goals)).toEqual({
      isRead: true,
      extraTime: true,
      goals: level,
      halfTime: { away: 1, home: 0 },
      shootout: { away: 4, home: 5 },
    });
  });

  it('reads a match in 90 minutes, half time from the note', () => {
    const report = final2001({
      result: '2:0',
      resultNote: '(1:0)',
      shootout: [],
    });
    expect(readMatchScore(report, { away: 0, home: 2 }, [])).toEqual({
      isRead: true,
      extraTime: false,
      goals: { away: 0, home: 2 },
      halfTime: { away: 0, home: 1 },
      shootout: null,
    });
  });

  it('reads extra time without a shootout', () => {
    const report = final2001({
      result: '2:1',
      resultNote: 'AET',
      shootout: [],
    });
    const read = readMatchScore(report, { away: 1, home: 2 }, []);
    expect(read.isRead && [read.extraTime, read.shootout]).toEqual([
      true,
      null,
    ]);
  });

  it('holds back a shown score that differs from the goals', () => {
    const report = final2001({
      result: '3:0',
      resultNote: '(1:0)',
      shootout: [],
    });
    expect(readMatchScore(report, { away: 0, home: 2 }, [])).toEqual({
      isRead: false,
      reason: 'the shown score differs from the goals',
    });
  });

  it('counts the 2006 final from its kicks: the box shows score plus shootout', () => {
    const report = final2001({
      result: '6:4',
      shootout: kicks(
        'h-Scored a-Scored h-Scored a-Missed h-Scored a-Scored h-Scored a-Scored h-Scored',
      ),
    });
    const read = readMatchScore(report, level, goals);
    expect(read.isRead && read.shootout).toEqual({ away: 3, home: 5 });
  });

  it('holds back a shootout the page does not show, or shows wrongly', () => {
    const hold = (overrides: Parameters<typeof final2001>[0]) =>
      readMatchScore(final2001(overrides), level, goals);
    expect(hold({ shootout: [] })).toEqual({
      isRead: false,
      reason: 'no shootout kicks on the page',
    });
    expect(hold({ shootout: kicks('h-Scored a-Scored') })).toEqual({
      isRead: false,
      reason: 'the shootout is a draw',
    });
    expect(hold({ result: '7:4' })).toEqual({
      isRead: false,
      reason: 'the shown score fits neither the shootout nor the score plus it',
    });
    expect(hold({ shootout: kicks('h-Scored a-Unknown') })).toEqual({
      isRead: false,
      reason: 'unknown shootout kick',
    });
    expect(
      hold({ result: '1:1', resultNote: 'AET', shootout: kicks('h-Scored') }),
    ).toEqual({ isRead: false, reason: 'shootout kicks without `on pens`' });
  });

  it('holds back an unknown note', () => {
    expect(
      readMatchScore(final2001({ resultNote: 'abandoned' }), level, goals),
    ).toEqual({ isRead: false, reason: 'unknown result note' });
  });
});

describe('halfTime', () => {
  it('counts goals up to minute 45 when there is no note', () => {
    expect(halfTime(null, [goal('home', 45), goal('away', 46)])).toEqual({
      away: 0,
      home: 1,
    });
  });

  it('is unknown when a goal has no minute', () => {
    expect(halfTime(null, [goal('home', null)])).toBeNull();
  });
});
