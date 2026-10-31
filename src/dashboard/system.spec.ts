import { processSpawner } from '@/dashboard/system.js';
import type { Stream } from '@/dashboard/runner.js';

// A local node process: no network, no shell
describe('processSpawner', () => {
  const spawner = processSpawner({ PATH: process.env.PATH });

  it('passes each line with its stream, and the exit code', async () => {
    const lines: [string, Stream][] = [];
    const code = await spawner(
      [
        process.execPath,
        '-e',
        "console.log('one\\ntwo'); console.error('three'); process.exit(3)",
      ],
      (line, stream) => lines.push([line, stream]),
    );
    expect(code).toBe(3);
    expect(lines.filter(([, s]) => s === 'out').map(([l]) => l)).toEqual([
      'one',
      'two',
    ]);
    expect(lines).toContainEqual(['three', 'err']);
  });

  it('takes argv as given: no shell expands it', async () => {
    const lines: string[] = [];
    await spawner(
      [process.execPath, '-e', 'console.log(process.argv[1])', '$HOME; ls'],
      (line) => lines.push(line),
    );
    expect(lines).toEqual(['$HOME; ls']);
  });

  it('answers 127 for a command that does not exist', async () => {
    const lines: string[] = [];
    const code = await spawner(['no-such-command-xyz'], (line) =>
      lines.push(line),
    );
    expect(code).toBe(127);
    expect(lines).toEqual(['could not start no-such-command-xyz: ENOENT']);
  });
});
