import { cropBox } from '@/images/crop.js';

describe('cropBox', () => {
  it('cuts a tall portrait from the top by default', () => {
    expect(cropBox(139, 181, 'top')).toEqual({
      left: 0,
      top: 0,
      width: 139,
      height: 139,
    });
  });

  it.each([
    ['centre', 21],
    ['bottom', 42],
    [10, 10],
    // An offset past the end stops at the bottom
    [500, 42],
  ] as const)('places a %s crop at %i px', (crop, top) => {
    expect(cropBox(139, 181, crop).top).toBe(top);
  });

  it('centres a wide image and keeps a square whole', () => {
    expect(cropBox(200, 100, 'top')).toEqual({
      left: 50,
      top: 0,
      width: 100,
      height: 100,
    });
    expect(cropBox(100, 100, 'bottom')).toEqual({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
    });
  });
});
