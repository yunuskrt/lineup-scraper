import { parseCsv } from '@/dashboard/csv.js';

describe('parseCsv', () => {
  it('splits rows and fields', () => {
    expect(parseCsv('a,b\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('reads quoted fields with commas, quotes and newlines', () => {
    expect(parseCsv('1,"error: a, b","say ""hi""","x\ny"\n')).toEqual([
      ['1', 'error: a, b', 'say "hi"', 'x\ny'],
    ]);
  });

  it('keeps empty fields and a last line with no newline', () => {
    expect(parseCsv('a,,c\r\nd,e,')).toEqual([
      ['a', '', 'c'],
      ['d', 'e', ''],
    ]);
  });

  it('gives no rows for an empty file', () => {
    expect(parseCsv('')).toEqual([]);
  });
});
