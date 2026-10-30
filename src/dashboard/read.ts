import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { toEntries, type Entry } from '@/dashboard/blocks.js';
import { parseLog, type LogLine } from '@/dashboard/history.js';
import { parseGeneral } from '@/dashboard/links.js';
import { DATA_DIRS } from '@/config/data-dirs.js';
import { MANIFEST } from '@/dataset/files.js';
import { poolMatchesSchema, type PoolMatch } from '@/pool/build.js';
import {
  POOL_CONFIG_FILE,
  readPoolConfig,
  type PoolConfig,
} from '@/pool/config.js';
import { remoteStatusSchema } from '@/status/remote.js';

export const FILES = {
  general: path.join(DATA_DIRS['inbox-lists'], 'general.csv'),
  matches: path.join(DATA_DIRS.work, 'pool', 'matches.json'),
  log: path.join(DATA_DIRS.work, 'import-log.ndjson'),
  remote: path.join(DATA_DIRS.work, 'status', 'remote.json'),
  manifest: path.join(DATA_DIRS.dataset, MANIFEST),
  config: POOL_CONFIG_FILE,
  inbox: DATA_DIRS.inbox,
} as const;

export type SnapshotFiles = Record<keyof typeof FILES, string>;

// What extract.inbox picks up
const INBOX_SUFFIXES = new Set([
  '.html',
  '.htm',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.svg',
]);

export interface Snapshot {
  config: PoolConfig;
  matches: PoolMatch[];
  entries: Entry[];
  log: LogLine[];
  inbox: string[];
  notes: string[];
  // A missing or invalid file, and the fix
  problems: string[];
  csvAt: number | null;
  sourcesAt: (number | null)[];
}

function modifiedAt(file: string): number | null {
  return existsSync(file) ? statSync(file).mtimeMs : null;
}

function readText(file: string): string | null {
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

// A SyntaxError quotes the file: never shown
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function readMatches(file: string, problems: string[]): PoolMatch[] {
  const text = readText(file);
  if (text === null) {
    problems.push('No pool match list: run `npm run pool`');
    return [];
  }
  const parsed = poolMatchesSchema.safeParse(parseJson(text));
  if (!parsed.success) {
    problems.push('data/work/pool/matches.json is invalid: run `npm run pool`');
    return [];
  }
  return parsed.data;
}

function readNotes(file: string, problems: string[]): string[] {
  const text = readText(file);
  if (text === null) return [];
  const parsed = remoteStatusSchema.safeParse(parseJson(text));
  if (!parsed.success) {
    problems.push('remote.json is invalid: run `npm run status`');
    return [];
  }
  return parsed.data.notes;
}

function readLog(file: string, problems: string[]): LogLine[] {
  const text = readText(file);
  if (text === null) return [];
  const parsed = parseLog(text);
  if (!parsed.success) {
    problems.push(parsed.error);
    return [];
  }
  return parsed.lines;
}

export function inboxFiles(dir = DATA_DIRS.inbox): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => INBOX_SUFFIXES.has(path.extname(name).toLowerCase()))
    .toSorted();
}

// Every local file the views need, read fresh
export function readSnapshot(files: SnapshotFiles = FILES): Snapshot {
  const problems: string[] = [];
  const config = readPoolConfig(files.config);
  const matches = readMatches(files.matches, problems);
  const text = readText(files.general);
  let entries: Entry[] = [];
  if (text === null) {
    problems.push('No general.csv: run `npm run status`');
  } else {
    const parsed = parseGeneral(text);
    if (parsed.success) entries = toEntries(parsed.rows, matches, config);
    else problems.push(`${parsed.error}: run \`npm run status\``);
  }
  return {
    config,
    matches,
    entries,
    log: readLog(files.log, problems),
    inbox: inboxFiles(files.inbox),
    notes: readNotes(files.remote, problems),
    problems,
    csvAt: modifiedAt(files.general),
    sourcesAt: [modifiedAt(files.log), modifiedAt(files.manifest)],
  };
}
