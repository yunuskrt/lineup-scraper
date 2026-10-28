import { checkTarget, parseArgs, type LoadArgs } from '@/load/target.js';

const DRY: LoadArgs = { apply: false, target: null, confirm: false };

describe('parseArgs', () => {
  it('reads the flags and the target', () => {
    expect(
      parseArgs(['--dry-run', '--target', 'production', '--confirm']),
    ).toEqual({
      success: true,
      args: { apply: false, target: 'production', confirm: true },
    });
  });

  it('refuses an unknown argument or a bare --target', () => {
    expect(parseArgs(['--force']).success).toBe(false);
    expect(parseArgs(['--target']).success).toBe(false);
  });
});

describe('checkTarget', () => {
  it.each(['ingest', 'disposable'] as const)('lets %s dry-run', (target) => {
    expect(checkTarget(target, DRY)).toEqual({
      success: true,
      allowProduction: false,
    });
  });

  it('refuses --apply until S15b', () => {
    expect(checkTarget('ingest', { ...DRY, apply: true })).toEqual({
      success: false,
      error: expect.stringContaining('S15b'),
    });
  });

  it('refuses a --target that differs from LOAD_TARGET', () => {
    expect(
      checkTarget('ingest', { ...DRY, target: 'production' }).success,
    ).toBe(false);
  });

  it('needs --target production --confirm for production', () => {
    expect(checkTarget('production', DRY).success).toBe(false);
    expect(
      checkTarget('production', { ...DRY, target: 'production' }).success,
    ).toBe(false);
    expect(
      checkTarget('production', {
        ...DRY,
        target: 'production',
        confirm: true,
      }),
    ).toEqual({ success: true, allowProduction: true });
  });
});
