import path from 'node:path';
import { DATA_DIRS } from '@/config/data-dirs.js';

describe('DATA_DIRS', () => {
  it('names the nine data folders', () => {
    expect(Object.keys(DATA_DIRS).sort()).toEqual([
      'cache',
      'curation',
      'dataset',
      'images',
      'inbox',
      'pages',
      'raw',
      'reports',
      'work',
    ]);
  });

  it('resolves each folder under the repo data directory', () => {
    const dataRoot = path.resolve(process.cwd(), 'data');
    for (const [name, dir] of Object.entries(DATA_DIRS)) {
      expect(dir).toBe(path.join(dataRoot, name));
    }
  });
});
