import { failuresOf, todoFor } from '@/dashboard/failures.js';
import { logLine } from '@/dashboard/history.spec.js';
import { entry } from '@/dashboard/spec-fixtures.js';

const NONE = { entries: [], log: [], inbox: [], notes: [] };

describe('todoFor', () => {
  it('follows the runbook', () => {
    expect(todoFor('challenge page')).toMatch(/Save the page again/);
    expect(todoFor('gate: home slot 4: no alias')).toMatch(/data\/curation/);
    expect(todoFor('No match rows')).toMatch(/--reparse --all/);
  });
});

describe('failuresOf', () => {
  it('lists rows at error by number, type and id', () => {
    const failures = failuresOf({
      ...NONE,
      entries: [
        entry('Match Report', 'error: gate: away slot 2: no alias', {}, '77'),
      ],
    });
    expect(failures).toEqual([
      {
        source: 'row',
        ref: '#1 Match Report 77',
        reason: 'gate: away slot 2: no alias',
        todo: todoFor('gate:'),
      },
    ]);
  });

  it('lists a refused file still in the inbox, once', () => {
    const log = [
      logLine({
        file: 'x.html',
        result: 'refused',
        reason: 'challenge page',
        kind: null,
        key: null,
      }),
      logLine({ file: 'gone.html', result: 'refused', reason: 'bad' }),
    ];
    const failures = failuresOf({ ...NONE, log, inbox: ['x.html'] });
    expect(failures).toEqual([
      {
        source: 'import',
        ref: 'x.html',
        reason: 'challenge page',
        todo: todoFor('challenge'),
      },
    ]);
  });

  it('drops a refusal whose page imported later, or shown as a row', () => {
    const log = [
      logLine({
        at: '2026-10-30T09:00:00Z',
        file: 'a.html',
        result: 'refused',
        key: '5',
      }),
      logLine({ at: '2026-10-30T10:00:00Z', file: 'b.html', key: '5' }),
      logLine({ file: 'c.html', result: 'refused', key: '6' }),
    ];
    const failures = failuresOf({
      ...NONE,
      entries: [entry('Match Report', 'error: bad', {}, '6')],
      log,
      inbox: ['a.html', 'c.html'],
    });
    // a.html is now a leftover file, not a refusal
    expect(failures.map((f) => [f.source, f.ref])).toEqual([
      ['row', '#1 Match Report 6'],
      ['inbox', 'a.html'],
    ]);
  });

  it('lists files waiting in the inbox and status notes', () => {
    const failures = failuresOf({
      ...NONE,
      inbox: ['player-9.html'],
      notes: ['database not checked: .env has no valid DATABASE_URL'],
    });
    expect(failures.map((f) => [f.source, f.ref])).toEqual([
      ['inbox', 'player-9.html'],
      ['note', 'npm run status'],
    ]);
  });

  it('lists the failed last run of a dashboard action', () => {
    const run = {
      id: 'batch' as const,
      label: 'Run batch',
      startedAt: '',
      endedAt: '',
      tail: [],
      lastStep: { label: 'npm run build', lines: [] },
    };
    const failures = failuresOf({
      ...NONE,
      runs: [
        { ...run, exitCode: 1, failedStep: 'npm run build' },
        {
          ...run,
          id: 'status',
          label: 'Refresh status',
          exitCode: 0,
          failedStep: null,
        },
      ],
    });
    expect(failures).toEqual([
      {
        source: 'run',
        ref: 'Run batch',
        reason: 'npm run build failed (exit 1)',
        todo: 'Read its output under Actions; fix, then run it again',
      },
    ]);
  });
});
