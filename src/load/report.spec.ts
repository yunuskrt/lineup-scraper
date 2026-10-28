import { planLoad } from '@/load/plan.js';
import type { ApplyReport } from '@/load/apply.js';
import { changeCount, renderPlan, renderReport } from '@/load/report.js';
import type { ContentRows } from '@/load/rows.js';

const EMPTY: ContentRows = {
  competitions: [],
  seasons: [],
  clubs: [],
  clubAliases: [],
  players: [],
  playerAliases: [],
  matches: [],
  matchTeams: [],
  lineups: [],
  matchEvents: [],
  memorabilityScores: [],
};

const WANTED: ContentRows = {
  ...EMPTY,
  players: [
    {
      slug: 'kahn',
      name: 'Oliver Kahn',
      imageKey: null,
      transfermarktId: '206',
    },
    {
      slug: 'sagnol',
      name: 'Willy Sagnol',
      imageKey: null,
      transfermarktId: '213',
    },
  ],
  playerAliases: [{ player: 'kahn', alias: 'Kahn', normalized: 'kahn' }],
};

const HELD: ContentRows = {
  ...EMPTY,
  players: [
    {
      slug: 'kahn',
      name: 'Oliver Kahn',
      imageKey: null,
      transfermarktId: null,
    },
  ],
  playerAliases: [{ player: 'kahn', alias: 'Titan', normalized: 'titan' }],
};

describe('renderPlan', () => {
  const plan = planLoad(WANTED, {
    rows: HELD,
    retirable: [],
    sessions: new Map(),
  });
  const lines = renderPlan(plan);

  it('prints one aligned line per table, counts only', () => {
    expect(lines).toHaveLength(11 + 4);
    expect(lines.find((l) => l.startsWith('players '))).toMatch(
      /^players +2 rows: 1 create, 1 update, 0 delete, 0 same$/,
    );
    expect(lines.find((l) => l.startsWith('playerAliases'))).toMatch(
      /1 create, 0 update, 1 delete, 0 same$/,
    );
    const widths = new Set(lines.slice(0, 11).map((l) => l.indexOf(' rows:')));
    expect(widths.size).toBe(1);
  });

  it('never prints a name or an alias', () => {
    const text = lines.join('\n');
    for (const value of ['Oliver Kahn', 'Kahn', 'Titan', 'sagnol']) {
      expect(text).not.toContain(value);
    }
  });

  it('ends with the XI, event, retirement and played counts', () => {
    expect(lines.slice(-4)).toEqual([
      'XIs rewritten whole: 0',
      'matches with events replaced: 0',
      'matches retired (score row deleted): 0',
      'played matches affected: 0',
    ]);
  });

  it('counts every create, update and delete', () => {
    expect(changeCount(plan)).toBe(1 + 1 + 1 + 1);
    expect(
      changeCount(
        planLoad(WANTED, { rows: WANTED, retirable: [], sessions: new Map() }),
      ),
    ).toBe(0);
  });
});

describe('renderReport', () => {
  it('prints rows and what was written, per table, counts only', () => {
    const plan = planLoad(WANTED, {
      rows: HELD,
      retirable: [],
      sessions: new Map(),
    });
    const written = Object.fromEntries(
      [
        'competitions',
        'seasons',
        'clubs',
        'clubAliases',
        'players',
        'playerAliases',
        'matches',
        'matchTeams',
        'lineups',
        'matchEvents',
        'memorabilityScores',
      ].map((t) => [t, { created: 0, updated: 0, deleted: 0 }]),
    ) as ApplyReport;
    written.players = { created: 1, updated: 1, deleted: 0 };
    const lines = renderReport(written, plan);
    expect(lines.find((l) => l.startsWith('players '))).toMatch(
      /^players +2 rows: 1 created, 1 updated, 0 deleted$/,
    );
    expect(lines.at(-1)).toBe('rows written: 2');
    expect(lines.join('\n')).not.toContain('Kahn');
  });
});
