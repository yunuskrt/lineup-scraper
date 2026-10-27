import { readFileSync } from 'node:fs';
import {
  formationNamesSchema,
  formationText,
  toFormation,
} from '@/lineups/formation.js';

const NAMES = formationNamesSchema.parse(
  JSON.parse(
    readFileSync(
      new URL('../../data/curation/formations.json', import.meta.url),
      'utf8',
    ),
  ),
);

describe('toFormation', () => {
  it('takes the lines of a plain or styled shape', () => {
    expect(toFormation('Starting Line-up: 4-2-3-1', NAMES)).toBe('4-2-3-1');
    expect(toFormation('Starting Line-up: 3-5-2 flat', NAMES)).toBe('3-5-2');
    expect(toFormation('Starting Line-up: 4-3-3 Attacking', NAMES)).toBe(
      '4-3-3',
    );
    expect(toFormation('Starting Line-up: 4-4-2 double 6', NAMES)).toBe(
      '4-4-2',
    );
  });

  it('maps the three diamonds from the curation file', () => {
    expect(toFormation('Starting Line-up: 4-4-2 Diamond', NAMES)).toBe(
      '4-1-2-1-2',
    );
    expect(toFormation('Starting Line-up: 3-4-3 Diamond', NAMES)).toBe(
      '3-1-2-1-3',
    );
    expect(toFormation('Starting Line-up:  5-4-1   Diamond', NAMES)).toBe(
      '5-1-2-1-1',
    );
  });

  it('never guesses: no lines, a bad total or no text is null', () => {
    expect(toFormation('Starting Line-up: Christmas tree', NAMES)).toBeNull();
    expect(toFormation('Starting Line-up: 4-4-3', NAMES)).toBeNull();
    expect(toFormation('Starting Line-up: 4-6', NAMES)).toBeNull();
    expect(toFormation(null, NAMES)).toBeNull();
  });

  it('refuses a curation entry that is not a formation', () => {
    expect(
      formationNamesSchema.safeParse({ 'X Diamond': '4-4-3' }).success,
    ).toBe(false);
  });

  it('shows the text without the prefix, spaces collapsed', () => {
    expect(formationText('Starting Line-up:  4-4-2   Diamond ')).toBe(
      '4-4-2 Diamond',
    );
  });
});
