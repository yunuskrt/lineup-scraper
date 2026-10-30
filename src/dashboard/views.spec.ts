import type { Snapshot } from '@/dashboard/read.js';
import { entry, poolMatch } from '@/dashboard/spec-fixtures.js';
import {
  coverageView,
  LINKS_PAGE,
  linksView,
  overview,
} from '@/dashboard/views.js';
import { CONFIG } from '@/pool/spec-fixtures.js';

describe('linksView', () => {
  const entries = [
    entry('Match Report', 'parsed', {}, '1118844'),
    entry(
      'Player',
      'error: bad',
      { groups: ['clashes'], season: '2010-11' },
      '206',
    ),
    entry('Fixture', 'parsed', { competition: 'CL' }, 'CL-2000'),
  ];

  it('filters by type, any error, group, competition, season and text', () => {
    const keys = (filter: Parameters<typeof linksView>[1]) =>
      linksView(entries, filter).rows.map((r) => r.key);
    expect(keys({ type: 'Player' })).toEqual(['206']);
    expect(keys({ status: 'error' })).toEqual(['206']);
    expect(keys({ status: 'parsed' })).toEqual(['1118844', 'CL-2000']);
    expect(keys({ group: 'clashes' })).toEqual(['206']);
    expect(keys({ competition: 'CL' })).toEqual(['CL-2000']);
    expect(keys({ season: '2010-11' })).toEqual(['206']);
    expect(keys({ q: ' cl-20 ' })).toEqual(['CL-2000']);
  });

  it('gives the facets from every row', () => {
    const { facets } = linksView(entries, { type: 'Player' });
    expect(facets.competitions).toEqual(['CL', 'TR1']);
    expect(facets.statuses).toContain('error');
  });

  it('pages by 100', () => {
    const many = Array.from({ length: LINKS_PAGE + 1 }, () =>
      entry('Player', 'saved'),
    );
    const view = linksView(many, { page: 2 });
    expect([view.total, view.page, view.pages, view.rows.length]).toEqual([
      101, 2, 2, 1,
    ]);
  });
});

describe('overview and coverageView', () => {
  const snapshot: Snapshot = {
    config: CONFIG,
    matches: [poolMatch('1118844')],
    entries: [entry('Match Report', 'ingested', {}, '1118844')],
    log: [],
    inbox: ['player-9.html'],
    notes: [],
    problems: ['No general.csv: run `npm run status`'],
    csvAt: 2,
    sourcesAt: [1],
  };

  it('gives totals, every breakdown, labels, problems and warnings', () => {
    const view = overview(snapshot);
    expect(Object.keys(view.breakdowns)).toEqual([
      'group',
      'competition',
      'season',
      'era',
      'club',
    ]);
    expect(view.breakdowns.club.map((r) => r.key)).toEqual(['141', '36']);
    expect(view.labels.clubs['36']).toBe('Fenerbahçe');
    expect(view.problems).toHaveLength(1);
    expect(view.warnings.map((w) => w.command)).toEqual([
      'uv run python -m extract.inbox',
    ]);
  });

  it('counts an ingested match report as playable', () => {
    const cell = coverageView(snapshot).cells.find(
      (c) => c.kind === 'leagueSeason' && c.period === '2002-03',
    );
    expect(cell).toMatchObject({ ingested: 1, pool: 1 });
  });
});
