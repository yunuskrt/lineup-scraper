import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_ROOT = fileURLToPath(new URL('../../data/', import.meta.url));

export const DATA_DIRS = {
  cache: path.join(DATA_ROOT, 'cache'),
  raw: path.join(DATA_ROOT, 'raw'),
  work: path.join(DATA_ROOT, 'work'),
  reports: path.join(DATA_ROOT, 'reports'),
  curation: path.join(DATA_ROOT, 'curation'),
  dataset: path.join(DATA_ROOT, 'dataset'),
} as const;

export type DataDirName = keyof typeof DATA_DIRS;
