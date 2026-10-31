import type { Step } from '@/dashboard/actions.js';
import {
  Runner,
  TAIL_LINES,
  type RunEvent,
  type Spawner,
} from '@/dashboard/runner.js';

const step = (label: string): Step => ({ label, argv: ['npm', label] });

// Each argv prints its name and exits with its code
function fakeSpawner(codes: Record<string, number>, lines = 1): Spawner {
  return (argv, onLine) => {
    const name = argv[1] ?? '';
    for (let i = 0; i < lines; i += 1) onLine(`${name} ${i}`, 'out');
    return Promise.resolve(codes[name] ?? 0);
  };
}

const at = () => new Date('2026-10-30T12:00:00Z');

describe('Runner', () => {
  it('runs the steps in order and reports each event', async () => {
    const runner = new Runner(fakeSpawner({}), at);
    const events: RunEvent['type'][] = [];
    runner.subscribe((e) => events.push(e.type));
    const started = runner.start('build', 'Build', [step('a'), step('b')]);
    if (!started.success) throw new Error('not started');
    const result = await started.done;
    expect(result).toMatchObject({
      id: 'build',
      exitCode: 0,
      failedStep: null,
      tail: ['a 0', 'b 0'],
      lastStep: { label: 'b', lines: ['b 0'] },
    });
    expect(events).toEqual(['start', 'step', 'line', 'step', 'line', 'end']);
  });

  it('stops at the first failing step and names it', async () => {
    const runner = new Runner(fakeSpawner({ b: 2 }), at);
    const started = runner.start('batch', 'Run batch', [
      step('a'),
      step('b'),
      step('c'),
    ]);
    if (!started.success) throw new Error('not started');
    const result = await started.done;
    expect([result.exitCode, result.failedStep, result.lastStep.label]).toEqual(
      [2, 'b', 'b'],
    );
  });

  it('runs one action at a time', async () => {
    const runner = new Runner(fakeSpawner({}), at);
    const first = runner.start('status', 'Refresh status', [step('a')]);
    expect(runner.running).toMatchObject({ id: 'status', step: 'a' });
    expect(runner.start('build', 'Build', [step('b')])).toEqual({
      success: false,
      error: 'Refresh status is running',
    });
    if (first.success) await first.done;
    expect(runner.running).toBeNull();
    expect(runner.start('build', 'Build', [step('b')]).success).toBe(true);
  });

  it('keeps the last result of each action and a bounded tail', async () => {
    const runner = new Runner(fakeSpawner({}, TAIL_LINES + 5), at);
    const started = runner.start('import', 'Import', [step('a')]);
    if (started.success) await started.done;
    const [last] = runner.lastResults();
    expect(last?.tail).toHaveLength(TAIL_LINES);
    expect(last?.lastStep.lines).toHaveLength(TAIL_LINES + 5);
  });

  it('counts a spawn that throws as a failure', async () => {
    const runner = new Runner(() => Promise.reject(new Error('no uv')), at);
    const started = runner.start('import', 'Import', [step('a')]);
    if (!started.success) throw new Error('not started');
    expect((await started.done).exitCode).toBe(1);
    expect(runner.running).toBeNull();
  });
});
