import { groupsFor, hasStage, poolRules } from '@/pool/groups.js';
import { CONFIG, row } from '@/pool/spec-fixtures.js';

const RULES = poolRules(CONFIG);

describe('groupsFor', () => {
  it('finds a league derby either way round', () => {
    expect(groupsFor(row('TR1', '36', '141'), RULES)).toEqual(['derbies']);
    expect(groupsFor(row('TR1', '141', '36'), RULES)).toEqual(['derbies']);
  });

  it('finds a derby in the Champions League group stage', () => {
    expect(
      groupsFor(row('CL', '36', '141', { round: 'Group A' }), RULES),
    ).toEqual(['derbies']);
  });

  it('keeps a Champions League derby quarter-final in both groups', () => {
    const quarter = row('CL', '141', '36', { stage: 'QF 2' });
    expect(groupsFor(quarter, RULES)).toEqual(['derbies', 'ucl-knockouts']);
  });

  it('finds a clash between two curated clubs that is not a derby', () => {
    expect(groupsFor(row('TR1', '141', '114'), RULES)).toEqual(['clashes']);
  });

  it('leaves out a curated club against any other opponent', () => {
    expect(groupsFor(row('TR1', '141', '3205'), RULES)).toEqual([]);
  });

  it('never matches a derby whose club has no id yet', () => {
    expect(groupsFor(row('TR1', '114', '449'), RULES)).toEqual([]);
  });

  it('keeps Champions League quarter-finals on, every leg, and nothing before', () => {
    expect(groupsFor(row('CL', '5', '418', { stage: 'QF 2' }), RULES)).toEqual([
      'ucl-knockouts',
    ]);
    expect(groupsFor(row('CL', '5', '418', { stage: 'FI' }), RULES)).toEqual([
      'ucl-knockouts',
    ]);
    expect(
      groupsFor(row('CL', '5', '418', { stage: 'Ro16 3' }), RULES),
    ).toEqual([]);
    expect(groupsFor(row('CL', '5', '418'), RULES)).toEqual([]);
  });

  it('finds a derby in the UEFA Cup / Europa League at any stage', () => {
    expect(
      groupsFor(row('EL', '36', '141', { stage: 'Ro16 2' }), RULES),
    ).toEqual(['derbies']);
  });

  it('keeps only the UEFA Cup / Europa League final', () => {
    expect(groupsFor(row('EL', '5', '418', { stage: 'FI' }), RULES)).toEqual([
      'uel-finals',
    ]);
    expect(groupsFor(row('EL', '5', '418', { stage: 'SF 1' }), RULES)).toEqual(
      [],
    );
  });

  it('keeps World Cup knockouts with the third-place match, not group games', () => {
    expect(
      groupsFor(row('FIWC', '3376', '3377', { stage: 'FI' }), RULES),
    ).toEqual(['world-cup-knockouts']);
    expect(
      groupsFor(row('FIWC', '3262', '3376', { stage: 'FI 3rd' }), RULES),
    ).toEqual(['world-cup-knockouts']);
    expect(
      groupsFor(row('FIWC', '3262', '8497', { round: 'Group A' }), RULES),
    ).toEqual([]);
  });

  it('ignores a competition the config does not name', () => {
    expect(groupsFor(row('TR2', '36', '141'), RULES)).toEqual([]);
  });
});

describe('hasStage', () => {
  it('matches a whole code or a code and its leg, never a longer word', () => {
    expect(hasStage('FI 3rd', ['FI'])).toBe(true);
    expect(hasStage('QF', ['QF'])).toBe(true);
    expect(hasStage('FINAL', ['FI'])).toBe(false);
    expect(hasStage(null, ['FI'])).toBe(false);
  });
});
