import { parseVerifyArgs } from '@/verify/args.js';

describe('parseVerifyArgs', () => {
  it('reads with no flags', () => {
    expect(parseVerifyArgs([])).toEqual({
      success: true,
      args: { apply: false, target: null, confirm: false },
    });
  });

  it('takes the production guard flags', () => {
    expect(parseVerifyArgs(['--target', 'production', '--confirm'])).toEqual({
      success: true,
      args: { apply: false, target: 'production', confirm: true },
    });
  });

  it('refuses --apply: verify never writes', () => {
    expect(parseVerifyArgs(['--apply'])).toEqual({
      success: false,
      error: 'verify only reads: no --apply',
    });
  });

  it('refuses an unknown flag', () => {
    expect(parseVerifyArgs(['--upload'])).toEqual({
      success: false,
      error: 'Unknown argument --upload',
    });
  });
});
