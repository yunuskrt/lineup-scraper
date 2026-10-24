import { existsSync } from 'node:fs';
import { DATA_DIRS } from '@/config/data-dirs.js';

for (const [name, dir] of Object.entries(DATA_DIRS)) {
  const state = existsSync(dir) ? 'present' : 'missing';
  console.log(`${name.padEnd(8)} ${state.padEnd(7)} ${dir}`);
}
