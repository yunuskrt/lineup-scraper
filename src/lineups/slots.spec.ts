import { assignSlots } from '@/lineups/slots.js';
import { starters } from '@/lineups/spec-fixtures.js';

function ids(key: string, formation: string): string[] {
  const result = assignSlots(starters(key), formation);
  if (!result.isMapped) throw new Error(result.reason);
  return result.starters.map((s) => s.transfermarktId);
}

describe('assignSlots', () => {
  it('maps the 2001 final: keeper, then each line right to left', () => {
    expect(ids('990248-home', '5-4-1')).toEqual([
      '206',
      '213',
      '208',
      '191',
      '209',
      '210',
      '217',
      '201',
      '197',
      '214',
      '198',
    ]);
    expect(ids('990248-away', '4-1-2-1-2')).toEqual([
      '7562',
      '51776',
      '7565',
      '7573',
      '7566',
      '4191',
      '7603',
      '7438',
      '3411',
      '7585',
      '3570',
    ]);
  });

  it('maps every saved side with slots 0–10 once', () => {
    for (const [key, formation] of [
      ['1153409-home', '3-4-1-2'],
      ['1153409-away', '3-1-4-2'],
      ['4126774-home', '4-2-3-1'],
      ['4126774-away', '4-2-3-1'],
    ] as const) {
      const result = assignSlots(starters(key), formation);
      expect(result.isMapped).toBe(true);
      if (result.isMapped) {
        expect(result.starters.map((s) => s.slot)).toEqual([
          0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
        ]);
      }
    }
  });

  it('takes positions from the formation, never the source', () => {
    const result = assignSlots(starters('4126774-home'), '4-2-3-1');
    expect(result.isMapped && result.starters.map((s) => s.position)).toEqual([
      'GK',
      'DF',
      'DF',
      'DF',
      'DF',
      'MF',
      'MF',
      'MF',
      'MF',
      'MF',
      'FW',
    ]);
  });

  it('refuses lines that overlap in height', () => {
    // A 5-4-1 read as 4-4-2 puts a defender in midfield
    expect(assignSlots(starters('990248-home'), '4-4-2')).toEqual({
      isMapped: false,
      reason: 'lines 1 and 2 overlap in height',
    });
  });

  it('refuses two starters on one spot of a line', () => {
    const side = starters('990248-away');
    side[10] = { sourceId: '3570', style: 'top: 2%; left: 50%;' };
    expect(assignSlots(side, '4-1-2-1-2')).toEqual({
      isMapped: false,
      reason: 'two starters share a left position in line 5',
    });
  });

  it('refuses a wrong count, a repeated player, no keeper or a bad style', () => {
    const side = starters('990248-away');
    expect(assignSlots(side.slice(1), '4-1-2-1-2')).toEqual({
      isMapped: false,
      reason: '10 starters, not 11',
    });
    const twice = side.map((s, i) =>
      i === 1 ? { ...s, sourceId: '7562' } : s,
    );
    expect(assignSlots(twice, '4-1-2-1-2').isMapped).toBe(false);
    const noKeeper = side.map((s, i) =>
      i === 0 ? { ...s, style: 'top: 79%; left: 40%;' } : s,
    );
    expect(assignSlots(noKeeper, '4-1-2-1-2')).toEqual({
      isMapped: false,
      reason: '0 keepers',
    });
    const noStyle = side.map((s, i) => (i === 3 ? { ...s, style: 'x' } : s));
    expect(assignSlots(noStyle, '4-1-2-1-2')).toEqual({
      isMapped: false,
      reason: 'a starter has no top or left',
    });
  });
});
