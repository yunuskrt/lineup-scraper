import {
  ACTION_IDS,
  parseActionRequest,
  STEPS,
  stepsFor,
} from '@/dashboard/actions.js';

const labels = (id: Parameters<typeof stepsFor>[0]) =>
  stepsFor(id, 10).map((s) => s.label);

describe('stepsFor', () => {
  it('runs the batch up to the dry run, never the load', () => {
    expect(labels('batch')).toEqual([
      'uv run python -m extract.inbox',
      'npm run status',
      'npm run build',
      'npm run images -- --upload --target ingest',
      'npm run load -- --target ingest',
    ]);
  });

  it('loads, then verifies, then refreshes the status', () => {
    expect(labels('load')).toEqual([
      'npm run load -- --apply --target ingest',
      'npm run verify -- --target ingest',
      'npm run status',
    ]);
  });

  it('passes N to open, and opens only the browser', () => {
    expect(stepsFor('open', 7)[0]?.argv).toEqual([
      'uv',
      'run',
      'python',
      '-m',
      'extract.links',
      'open',
      'general',
      '--count',
      '7',
    ]);
  });

  it('only ever runs npm or uv, and each branch command names ingest', () => {
    for (const id of ACTION_IDS) {
      for (const step of stepsFor(id, 1)) {
        expect(['npm', 'uv']).toContain(step.argv[0]);
      }
    }
    for (const step of [
      STEPS.upload,
      STEPS.dryRun,
      STEPS.apply,
      STEPS.verify,
    ]) {
      expect(step.argv.slice(-2)).toEqual(['--target', 'ingest']);
    }
    expect(JSON.stringify(ACTION_IDS.map((id) => stepsFor(id, 1)))).not.toMatch(
      /production|--confirm/,
    );
  });
});

describe('parseActionRequest', () => {
  it('takes a known id and defaults N to 10', () => {
    expect(parseActionRequest('open', {})).toEqual({
      success: true,
      id: 'open',
      count: 10,
    });
    expect(parseActionRequest('open', { count: 50 })).toMatchObject({
      count: 50,
    });
  });

  it('refuses an unknown id, N out of 1–50 and any other key', () => {
    expect(parseActionRequest('rm', {}).success).toBe(false);
    expect(parseActionRequest('open', { count: 0 }).success).toBe(false);
    expect(parseActionRequest('open', { count: 51 }).success).toBe(false);
    expect(parseActionRequest('open', { count: 2.5 }).success).toBe(false);
    expect(parseActionRequest('status', { argv: ['rm'] }).success).toBe(false);
  });
});
