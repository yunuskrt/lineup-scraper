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
  // Pages the user saved, before and after import
  inbox: path.join(DATA_ROOT, 'inbox'),
  pages: path.join(DATA_ROOT, 'pages'),
  // Crests and photos the user saved, by id
  images: path.join(DATA_ROOT, 'images'),
} as const;

export type DataDirName = keyof typeof DATA_DIRS;
