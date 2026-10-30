import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { logLine } from '@/dashboard/history.spec.js';
import {
  inboxFiles,
  readSnapshot,
  type SnapshotFiles,
} from '@/dashboard/read.js';
import { HEADER, LINKS, poolMatch } from '@/dashboard/spec-fixtures.js';
import { CONFIG } from '@/pool/spec-fixtures.js';

function folder(): SnapshotFiles {
  const dir = mkdtempSync(path.join(tmpdir(), 'dashboard-read-'));
  const at = (name: string) => path.join(dir, name);
  writeFileSync(at('pool.json'), JSON.stringify(CONFIG));
  mkdirSync(at('inbox'));
  return {
    general: at('general.csv'),
    matches: at('matches.json'),
    log: at('import-log.ndjson'),
    remote: at('remote.json'),
    manifest: at('manifest.json'),
    config: at('pool.json'),
    inbox: at('inbox'),
  };
}

describe('readSnapshot', () => {
  it('names the command for each missing file', () => {
    const snapshot = readSnapshot(folder());
    expect(snapshot.problems).toEqual([
      'No pool match list: run `npm run pool`',
      'No general.csv: run `npm run status`',
    ]);
    expect([snapshot.entries, snapshot.log, snapshot.csvAt]).toEqual([
      [],
      [],
      null,
    ]);
  });

  it('reports invalid files by path, never by their text', () => {
    const files = folder();
    writeFileSync(files.matches, '{"secret": ');
    writeFileSync(files.remote, '{}');
    writeFileSync(files.general, '#,Link\n');
    const { problems } = readSnapshot(files);
    expect(problems).toEqual([
      'data/work/pool/matches.json is invalid: run `npm run pool`',
      'general.csv: unexpected header: run `npm run status`',
      'remote.json is invalid: run `npm run status`',
    ]);
    expect(problems.join(' ')).not.toMatch(/secret/);
  });

  it('reads the rows, the log, the inbox and the notes', () => {
    const files = folder();
    writeFileSync(files.matches, JSON.stringify([poolMatch('1118844')]));
    writeFileSync(
      files.general,
      `${HEADER}\n1,Match Report,${LINKS['Match Report']('1118844')},match-1118844.html,data/inbox/,parsed\n`,
    );
    writeFileSync(files.log, `${JSON.stringify(logLine())}\n`);
    writeFileSync(
      files.remote,
      JSON.stringify({
        validated: { match: [], player: [] },
        errors: { match: {} },
        uploaded: null,
        ingested: null,
        notes: ['database not checked'],
      }),
    );
    writeFileSync(path.join(files.inbox, 'player-9.html'), '');
    const snapshot = readSnapshot(files);
    expect(snapshot.problems).toEqual([]);
    expect(snapshot.entries[0]?.context.season).toBe('2002-03');
    expect(snapshot.log).toHaveLength(1);
    expect(snapshot.inbox).toEqual(['player-9.html']);
    expect(snapshot.notes).toEqual(['database not checked']);
    expect(snapshot.csvAt).not.toBeNull();
  });
});

describe('inboxFiles', () => {
  it('lists what extract.inbox picks up, sorted', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dashboard-inbox-'));
    for (const name of [
      'b.HTML',
      'a.jpg',
      '.DS_Store',
      '.gitkeep',
      'notes.txt',
    ]) {
      writeFileSync(path.join(dir, name), '');
    }
    expect(inboxFiles(dir)).toEqual(['a.jpg', 'b.HTML']);
    expect(inboxFiles(path.join(dir, 'none'))).toEqual([]);
  });
});
