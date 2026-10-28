import type { DatasetBuild } from '@/dataset/build.js';
import { renderReport } from '@/dataset/report.js';

const BUILD: DatasetBuild = {
  dataset: { competitions: [], clubs: [], players: [], matches: [] },
  left: [
    { slug: 'a', reason: 'no lineup' },
    { slug: 'b', reason: 'failed the gate' },
    { slug: 'c', reason: 'no lineup' },
  ],
  droppedEvents: [{ slug: 'd', count: 2 }],
  eventOnly: ['player-500'],
};

const FILES = new Map([
  ['players.json', '[]\n'],
  ['manifest.json', '{}\n'],
]);

describe('renderReport', () => {
  const text = renderReport(BUILD, FILES);

  it('counts the lists and the matches left out', () => {
    expect(text).toContain(
      'Matches: 0. Competitions: 0. Clubs: 0. Players: 0. Pool matches left out: 3.',
    );
    expect(text).toContain('- failed the gate: 1\n- no lineup: 2');
  });

  it('lists files, matches left out, dropped events and event-only players', () => {
    expect(text).toContain('- `manifest.json`\n- `players.json`');
    expect(text).toContain('- `b`: failed the gate');
    expect(text).toContain('- `d`: 2');
    expect(text).toContain('- `player-500`');
  });

  it('leaves out empty sections', () => {
    const quiet = renderReport(
      { ...BUILD, left: [], droppedEvents: [], eventOnly: [] },
      FILES,
    );
    expect(quiet).not.toContain('## Left out');
    expect(quiet).not.toContain('## Events left out');
    expect(quiet).not.toContain('## Players only');
  });
});
