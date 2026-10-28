import { isNotFound } from '@/storage/client.js';

function sdkError(httpStatusCode: number) {
  return Object.assign(new Error('NotFound'), {
    $metadata: { httpStatusCode },
  });
}

describe('isNotFound', () => {
  it('reads a 404 as a missing object', () => {
    expect(isNotFound(sdkError(404))).toBe(true);
  });

  it.each([403, 500, 503])('keeps a %i an error', (status) => {
    expect(isNotFound(sdkError(status))).toBe(false);
  });

  it.each([
    ['a plain error', new Error('ECONNRESET')],
    ['a string', 'boom'],
    ['null', null],
  ])('keeps %s an error', (_, error) => {
    expect(isNotFound(error)).toBe(false);
  });
});
