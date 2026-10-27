import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DATA_DIRS } from '@/config/data-dirs.js';
import { stageNamesSchema } from '@/resolve/curation.js';
import { stageText } from '@/resolve/stage.js';

const NAMES = stageNamesSchema.parse(
  JSON.parse(
    readFileSync(path.join(DATA_DIRS.curation, 'stage-names.json'), 'utf8'),
  ),
);

describe('stageNamesSchema', () => {
  it('refuses a round pattern that is not a valid regular expression', () => {
    const result = stageNamesSchema.safeParse({
      stages: {},
      rounds: [{ pattern: '([0-9]+', text: 'Matchday $1' }],
    });
    expect(result.success).toBe(false);
  });
});

describe('stageText with data/curation/stage-names.json', () => {
  it.each([
    ['FI', 'Final'],
    ['FI 3rd', 'Third-place play-off'],
    ['SF 2', 'Semi-final'],
    ['QF', 'Quarter-final'],
    ['QF 4', 'Quarter-final'],
    ['Ro16 7', 'Round of 16'],
  ])('knockout code %s → %s', (stage, text) => {
    expect(stageText(stage, 'Knockout stage', NAMES)).toBe(text);
  });

  it('turns rounds into display text', () => {
    expect(stageText(null, '6.Matchday', NAMES)).toBe('Matchday 6');
    expect(stageText(null, '34.Matchday', NAMES)).toBe('Matchday 34');
    expect(stageText(null, 'Group A', NAMES)).toBe('Group A');
  });

  it('leaves what it cannot map as null, never a guess', () => {
    expect(stageText('PO', 'Knockout stage', NAMES)).toBeNull();
    expect(stageText(null, 'Intermediate stage', NAMES)).toBeNull();
    expect(stageText(null, null, NAMES)).toBeNull();
  });
});
