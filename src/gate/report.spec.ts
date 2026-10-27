import type { GateResult } from '@/gate/gate.js';
import { renderReport } from '@/gate/report.js';

const SIDES = {
  away: { guessability: 1, starPower: 0.4 },
  home: { guessability: 0.9545, starPower: 0.5 },
};

const RESULTS: GateResult[] = [
  { failures: [], passed: true, sides: SIDES, slug: 'a' },
  {
    failures: [
      { at: 'home slot 3', rule: 'no alias of their own' },
      { at: 'away slot 9', rule: 'breaks 4-4-2' },
      { at: 'away slot 10', rule: 'breaks 4-4-2' },
    ],
    passed: false,
    sides: SIDES,
    slug: 'b',
  },
  {
    failures: [
      { at: 'home', rule: '10 starters' },
      { at: 'away', rule: '9 starters' },
    ],
    passed: false,
    sides: SIDES,
    slug: 'e',
  },
];

describe('renderReport', () => {
  const text = renderReport(RESULTS, ['c', 'd']);

  it('counts passed, failed and waiting matches', () => {
    expect(text).toContain(
      'Matches checked: 3. Passed: 1. Failed: 2. Waiting for a match report: 2.',
    );
  });

  it('groups failures by rule, every formation together', () => {
    expect(text).toContain('- breaks its formation: 2');
    expect(text).toContain('- no alias of their own: 1');
    expect(text).toContain('- not 11 starters: 2');
    expect(text).toContain(
      '- `b`: home slot 3: no alias of their own; away slot 9: breaks 4-4-2',
    );
  });

  it('lists sides below 1 and the waiting matches', () => {
    expect(text).toContain('- `a` home: 0.9545');
    expect(text).not.toContain('`a` away');
    expect(text).toContain('- `c`\n- `d`');
  });
});
