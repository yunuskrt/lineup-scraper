import { parseImageArgs } from '@/images/args.js';

describe('parseImageArgs', () => {
  it('reads --upload and the production flags', () => {
    expect(
      parseImageArgs(['--upload', '--target', 'production', '--confirm']),
    ).toEqual({
      success: true,
      args: { apply: true, target: 'production', confirm: true },
    });
    expect(parseImageArgs([])).toEqual({
      success: true,
      args: { apply: false, target: null, confirm: false },
    });
  });

  it('refuses anything else', () => {
    expect(parseImageArgs(['--apply']).success).toBe(false);
    expect(parseImageArgs(['--target']).success).toBe(false);
  });
});
