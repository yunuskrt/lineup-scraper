import { entry } from '@/dashboard/spec-fixtures.js';
import { warningsOf } from '@/dashboard/warnings.js';

const QUIET = { entries: [], inbox: 0, csvAt: 2, sourcesAt: [1, null] };

describe('warningsOf', () => {
  it('is quiet when there is nothing to check', () => {
    expect(warningsOf(QUIET)).toEqual([]);
  });

  it('counts errors, inbox files and a load that is due', () => {
    const warnings = warningsOf({
      ...QUIET,
      inbox: 3,
      entries: [
        entry('Match Report', 'error: gate: x'),
        entry('Match Report', 'validated'),
        entry('Player', 'validated'),
        entry('Player', 'ingested'),
      ],
    });
    expect(warnings.map((w) => w.message)).toEqual([
      'Rows at error: 1',
      'Files waiting in data/inbox/: 3',
      'Validated matches and players not ingested: 2',
    ]);
  });

  it('flags saved images only under a validated match', () => {
    const entries = [
      entry('Match Report', 'validated', {}, '1118844'),
      entry('Crest', 'saved', { match: '1118844' }),
      entry('PlayerPhoto', 'saved', { match: '999' }),
    ];
    const messages = warningsOf({ ...QUIET, entries }).map((w) => w.message);
    expect(messages).toContain('Images of validated matches not uploaded: 1');
  });

  it('asks for npm run status when general.csv is old or missing', () => {
    expect(warningsOf({ ...QUIET, csvAt: 1, sourcesAt: [5, 2] })).toEqual([
      {
        message: 'general.csv is older than the last import or build',
        command: 'npm run status',
      },
    ]);
    expect(warningsOf({ ...QUIET, csvAt: null })[0]?.message).toBe(
      'general.csv is missing',
    );
  });
});
