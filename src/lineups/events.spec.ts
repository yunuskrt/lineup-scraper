import { readCard, readClock, readEvents } from '@/lineups/events.js';
import { event, final2001 } from '@/lineups/spec-fixtures.js';

const sprite = (position: string) => `background-position: ${position};`;

describe('readClock', () => {
  it('reads the minute from the sprite cell', () => {
    // 990248: the timeline puts these at 2.5 % and 41.67 % of 120'
    expect(readClock(sprite('-72px -0px'), null)).toEqual({
      addedTime: null,
      minute: 3,
    });
    expect(readClock(sprite('-324px -144px'), null)).toEqual({
      addedTime: null,
      minute: 50,
    });
    expect(readClock(sprite('-216px -360px'), null).minute).toBe(107);
  });

  it('hangs added time off the end of a half', () => {
    // 1153409: Zidane's penalty, 90+2
    expect(readClock(sprite('-324px -288px'), '+2')).toEqual({
      addedTime: 2,
      minute: 90,
    });
    expect(readClock(sprite('-144px -144px'), '+1')).toEqual({
      addedTime: 1,
      minute: 45,
    });
  });

  it('gives an unknown minute off the grid, past 120 or with odd added time', () => {
    const unknown = { addedTime: null, minute: null };
    expect(readClock(sprite('-0px -433px'), null)).toEqual(unknown);
    expect(readClock(sprite('-0px -432px'), null)).toEqual(unknown);
    expect(readClock(sprite('-36px -0px'), '+3')).toEqual(unknown);
    expect(readClock(sprite('-324px -288px'), '+31')).toEqual(unknown);
    expect(readClock(null, null)).toEqual(unknown);
  });
});

describe('readCard', () => {
  it('keeps red cards and second yellows, drops yellows', () => {
    expect(readCard('Player 1. Red card , Serious foul play')).toBe('red_card');
    expect(readCard('Player 1. Second yellow , Foul')).toBe('red_card');
    expect(readCard('Player 2. Yellow card , Foul')).toBe('yellow');
    expect(readCard('Player , Something else')).toBe('unread');
  });
});

describe('readEvents', () => {
  it('reads the 2001 final: two penalties, no red card', () => {
    expect(readEvents(final2001(), ['away', 'home'])).toEqual({
      events: [
        {
          addedTime: null,
          kind: 'penalty_goal',
          minute: 3,
          player: '7603',
          side: 'away',
        },
        {
          addedTime: null,
          kind: 'penalty_goal',
          minute: 50,
          player: '197',
          side: 'home',
        },
      ],
      unreadCards: 0,
    });
  });

  it('calls a goal by a player of the other side an own goal', () => {
    const report = final2001({
      events: [event('goal', 'home', '-36px -0px', '1:0 Defender', ['7565'])],
    });
    expect(readEvents(report, ['home']).events[0]!.kind).toBe('own_goal');
  });

  it('calls a goal an own goal when the text says so', () => {
    const report = final2001({
      events: [event('goal', 'home', null, '1:0 Defender , Own-goal', ['999'])],
    });
    expect(readEvents(report, ['home']).events[0]!.kind).toBe('own_goal');
  });

  it('keeps a red card with its own side, unknown minutes last', () => {
    const report = final2001({
      events: [
        event('card', 'home', '-0px -433px', 'Player 1. Red card', ['191']),
        event('card', 'away', '-36px -36px', 'Player 1. Second yellow', [
          '7562',
        ]),
        event('card', 'away', '-0px -0px', 'Player , Unknown', ['7562']),
      ],
    });
    expect(readEvents(report, [])).toEqual({
      events: [
        {
          addedTime: null,
          kind: 'red_card',
          minute: 12,
          player: '7562',
          side: 'away',
        },
        {
          addedTime: null,
          kind: 'red_card',
          minute: null,
          player: '191',
          side: 'home',
        },
      ],
      unreadCards: 1,
    });
  });
});
