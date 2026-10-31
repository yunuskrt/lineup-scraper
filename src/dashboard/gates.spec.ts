import {
  dryRunChanges,
  gatesOf,
  targetFrom,
  type DryRun,
  type GateInput,
} from '@/dashboard/gates.js';

const DRY: DryRun = {
  at: '2026-10-30T12:00:00Z',
  manifestHash: 'h1',
  changes: 4,
  lines: ['changes a load would make: 4 (nothing written)'],
};
const READY: GateInput = {
  target: 'ingest',
  running: null,
  dryRun: DRY,
  manifestHash: 'h1',
};

describe('gatesOf', () => {
  it('opens every action on ingest after a dry run with changes', () => {
    expect(Object.values(gatesOf(READY)).every((g) => g.enabled)).toBe(true);
  });

  it('closes every action while one runs', () => {
    const gates = gatesOf({
      ...READY,
      running: { id: 'build', label: 'Build', step: 'x', startedAt: '' },
    });
    expect(gates.status).toEqual({
      enabled: false,
      reason: 'Build is running',
    });
  });

  it('closes branch actions off ingest, never the local ones', () => {
    for (const target of ['disposable', 'production'] as const) {
      const gates = gatesOf({ ...READY, target });
      expect(gates.load.reason).toBe(
        `LOAD_TARGET is ${target}: the dashboard acts on ingest only`,
      );
      expect(
        [gates.upload, gates['dry-run'], gates.batch].some((g) => g.enabled),
      ).toBe(false);
      expect(
        [gates.import, gates.build, gates.open].every((g) => g.enabled),
      ).toBe(true);
    }
    expect(gatesOf({ ...READY, target: null }).verify.reason).toBe(
      '.env has no valid LOAD_TARGET',
    );
  });

  it('opens the load only after a dry run of this dataset with changes', () => {
    expect(gatesOf({ ...READY, dryRun: null }).load.reason).toBe(
      'Run a dry run first',
    );
    expect(gatesOf({ ...READY, manifestHash: 'h2' }).load.reason).toBe(
      'The dataset changed since the dry run: run it again',
    );
    expect(
      gatesOf({ ...READY, dryRun: { ...DRY, changes: 0 } }).load.reason,
    ).toBe('The dry run found nothing to load');
  });
});

describe('dryRunChanges', () => {
  it("reads the loader's change count", () => {
    expect(
      dryRunChanges(['a', 'changes a load would make: 12 (nothing written)']),
    ).toBe(12);
    expect(dryRunChanges(['no count'])).toBeNull();
  });
});

describe('targetFrom', () => {
  it('takes the shell first, then .env, then ingest', () => {
    expect(
      targetFrom({ LOAD_TARGET: 'disposable' }, 'LOAD_TARGET=ingest'),
    ).toBe('disposable');
    expect(targetFrom({}, '# x\nLOAD_TARGET=production\n')).toBe('production');
    expect(targetFrom({}, 'DATABASE_URL=x')).toBe('ingest');
    expect(targetFrom({}, null)).toBe('ingest');
  });

  it('gives null for an unknown target', () => {
    expect(targetFrom({}, 'LOAD_TARGET=dev')).toBeNull();
  });
});
