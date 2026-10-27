import { readFileSync } from 'node:fs';
import path from 'node:path';
import { aliasCurationSchema } from '@/aliases/curation.js';
import { DATA_DIRS } from '@/config/data-dirs.js';

describe('committed alias curation', () => {
  it('data/curation/aliases.json passes its schema', () => {
    const file = path.join(DATA_DIRS.curation, 'aliases.json');
    const value: unknown = JSON.parse(readFileSync(file, 'utf8'));
    expect(aliasCurationSchema.safeParse(value).success).toBe(true);
  });
});
