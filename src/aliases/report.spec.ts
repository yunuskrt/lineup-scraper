import { buildAliases, type PlayerNames } from '@/aliases/build.js';
import { renderReport } from '@/aliases/report.js';
import { checkXis } from '@/aliases/xi.js';

function player(id: string, name: string, candidates: string[] = []) {
  const names: PlayerNames = {
    slug: `p-${id}`,
    transfermarktId: id,
    name,
    aliasCandidates: candidates,
    fullName: null,
    nameInHomeCountry: null,
  };
  return names;
}

const PLAYERS = [
  player('1', 'Dean Harlow'),
  player('2', 'Rhys Harlow', ['Rhys Harl.']),
  player('3', 'Ian Pennock'),
];

function report(curation = {}) {
  const sets = buildAliases(PLAYERS, curation);
  const xis = checkXis(
    [{ match: 'm-1', side: 'away', starters: ['1', '2', '3', '99'] }],
    new Map(sets.players.map((p) => [p.transfermarktId, p])),
  );
  return renderReport(sets, xis);
}

describe('renderReport', () => {
  it('counts kept aliases by source and the XI findings', () => {
    const text = report();
    expect(text).toContain(
      'Aliases kept: 6 (name 3, surname 3, report 0, fullName 0, curation 0). ' +
        'Names dropped: 1.',
    );
    expect(text).toContain(
      '1 shared aliases, 0 fuzzy neighbours, 0 unrevealable starters, ' +
        '1 starters with no aliases.',
    );
    expect(text).toContain('`m-1` away: `harlow` → `p-1`, `p-2`');
    expect(text).toContain('`m-1` away: spieler 99');
    expect(text.endsWith('\n')).toBe(true);
  });

  it('names a dropped name by slug and reason, never its text', () => {
    const text = report();
    expect(text).toContain('`p-2`: report, dot');
    expect(text).not.toContain('Harl.');
  });

  it('leaves out empty sections and lists curation warnings', () => {
    expect(report()).not.toContain('## Curation warnings');
    expect(report()).not.toContain('## Fuzzy neighbours');
    expect(report({ 7: { add: [], remove: [] } })).toContain(
      '- `aliases.json 7`: not a resolved player',
    );
  });
});
