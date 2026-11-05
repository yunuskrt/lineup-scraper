import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readImageCuration, readLogoStyles } from '@/images/curation.js';

let file: string;

beforeEach(() => {
  file = path.join(
    mkdtempSync(path.join(tmpdir(), 'curation-')),
    'images.json',
  );
});

afterEach(() => {
  rmSync(path.dirname(file), { recursive: true, force: true });
});

function write(value: unknown) {
  writeFileSync(file, JSON.stringify(value));
}

describe('readLogoStyles', () => {
  it('reads the logo styles beside the photo crops', () => {
    write({
      photoCrops: { 'oliver-kahn': 'top' },
      logoStyles: { euro: 'white' },
    });
    expect(readLogoStyles(file)).toEqual(new Map([['euro', 'white']]));
    expect(readImageCuration(file)).toEqual(new Map([['oliver-kahn', 'top']]));
  });

  it('has no styles when the file has none', () => {
    write({ photoCrops: {} });
    expect(readLogoStyles(file)).toEqual(new Map());
    expect(readLogoStyles(path.join(path.dirname(file), 'none.json'))).toEqual(
      new Map(),
    );
  });

  it('refuses a style it does not know, naming the path', () => {
    write({ photoCrops: {}, logoStyles: { euro: 'black' } });
    expect(() => readLogoStyles(file)).toThrow(
      'Invalid images.json at logoStyles.euro',
    );
  });
});
