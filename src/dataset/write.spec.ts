import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { DatasetInput } from '@/dataset/schema.js';
import { writeDataset } from '@/dataset/write.js';

const EMPTY: DatasetInput = {
  competitions: [],
  clubs: [],
  players: [],
  matches: [],
};

describe('writeDataset', () => {
  let root: string;
  let target: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'dataset-'));
    target = path.join(root, 'dataset');
    // A previous build, with a match file that is gone now
    mkdirSync(path.join(target, 'matches', 'super-lig'), { recursive: true });
    writeFileSync(
      path.join(target, 'matches', 'super-lig', '2002-03.json'),
      '[]\n',
    );
    writeFileSync(path.join(target, 'competitions.json'), 'old\n');
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('replaces the folder whole and leaves no temporary folder', () => {
    const result = writeDataset(target, EMPTY, 'hash');
    expect(result.success).toBe(true);
    expect(readdirSync(target).toSorted()).toEqual([
      '.gitkeep',
      'clubs.json',
      'competitions.json',
      'manifest.json',
      'players.json',
    ]);
    expect(readFileSync(path.join(target, 'competitions.json'), 'utf8')).toBe(
      '[]\n',
    );
    expect(readdirSync(root)).toEqual(['dataset']);
  });

  it('writes nothing and names the path when the dataset is invalid', () => {
    const invalid = {
      ...EMPTY,
      competitions: [{ slug: 'Bad Slug', kind: 'league', name: 'X' }],
    } as DatasetInput;
    const result = writeDataset(target, invalid, 'hash');
    expect(result).toEqual({
      success: false,
      error: expect.stringContaining('competitions[0].slug'),
    });
    expect(result.success ? '' : result.error).not.toContain('Bad Slug');
    expect(readFileSync(path.join(target, 'competitions.json'), 'utf8')).toBe(
      'old\n',
    );
    expect(existsSync(path.join(target, 'matches', 'super-lig'))).toBe(true);
    expect(readdirSync(root)).toEqual(['dataset']);
  });

  it('writes a first build where none existed', () => {
    rmSync(target, { recursive: true });
    expect(writeDataset(target, EMPTY, 'hash').success).toBe(true);
    expect(existsSync(path.join(target, 'manifest.json'))).toBe(true);
  });
});
