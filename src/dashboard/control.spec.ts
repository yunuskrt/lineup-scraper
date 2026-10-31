import { createControl, type ControlDeps } from '@/dashboard/control.js';
import { checkActionHeaders, TOKEN_HEADER } from '@/dashboard/guard.js';
import { Runner, type Spawner } from '@/dashboard/runner.js';
import type { LoadTarget } from '@/config/env.schema.js';

// The loader's last line decides the change count
function spawner(changes: number, codes: Record<string, number> = {}): Spawner {
  return (argv, onLine) => {
    const name = argv[3] ?? '';
    if (name === 'load') {
      onLine(`changes a load would make: ${changes} (nothing written)`, 'out');
    }
    return Promise.resolve(codes[name] ?? 0);
  };
}

function setup(changes = 3, codes: Record<string, number> = {}) {
  const env = { target: 'ingest' as LoadTarget | null, hash: 'h1' };
  const runner = new Runner(spawner(changes, codes));
  const deps: ControlDeps = {
    runner,
    target: () => env.target,
    manifestHash: () => env.hash,
    isDatasetDirty: () => false,
  };
  return { control: createControl(deps), env };
}

async function settle() {
  await new Promise((resolve) => setImmediate(resolve));
}

describe('createControl', () => {
  it('opens the load after a passed dry run, and a load uses it up', async () => {
    const { control } = setup();
    expect(control.start('load', 10)).toEqual({
      success: false,
      status: 403,
      error: 'Run a dry run first',
    });
    expect(control.start('dry-run', 10)).toEqual({ success: true });
    await settle();
    expect(control.status().dryRun?.changes).toBe(3);
    expect(control.status().gates.load.enabled).toBe(true);
    expect(control.start('load', 10)).toEqual({ success: true });
    await settle();
    expect(control.status().dryRun).toBeNull();
    expect(control.status().gates.load.enabled).toBe(false);
  });

  it('records a passed batch as a dry run, not a failed one', async () => {
    const failing = setup(3, { build: 1 });
    failing.control.start('batch', 10);
    await settle();
    expect(failing.control.status().dryRun).toBeNull();
    const passing = setup();
    passing.control.start('batch', 10);
    await settle();
    expect(passing.control.status().dryRun?.manifestHash).toBe('h1');
  });

  it('closes the load when the dataset changes or the target moves', async () => {
    const { control, env } = setup();
    control.start('dry-run', 10);
    await settle();
    env.hash = 'h2';
    expect(control.status().gates.load.enabled).toBe(false);
    env.hash = 'h1';
    env.target = 'disposable';
    expect(control.start('load', 10)).toMatchObject({
      success: false,
      status: 403,
    });
  });

  it('answers 409 while an action runs', () => {
    const { control } = setup();
    control.start('build', 10);
    expect(control.start('status', 10)).toEqual({
      success: false,
      status: 409,
      error: 'Build is running',
    });
  });
});

describe('checkActionHeaders', () => {
  const token = 'a'.repeat(48);
  const ok = { origin: 'http://127.0.0.1:4319', [TOKEN_HEADER]: token };

  it('accepts its own origin with the token', () => {
    expect(checkActionHeaders(ok, token, 4319)).toBeNull();
    expect(
      checkActionHeaders(
        { ...ok, origin: 'http://localhost:4319' },
        token,
        4319,
      ),
    ).toBeNull();
  });

  it('refuses a foreign or missing origin and a wrong token', () => {
    expect(
      checkActionHeaders({ ...ok, origin: 'http://evil.example' }, token, 4319),
    ).toBe('foreign origin');
    expect(checkActionHeaders({ [TOKEN_HEADER]: token }, token, 4319)).toBe(
      'foreign origin',
    );
    expect(
      checkActionHeaders(
        { ...ok, [TOKEN_HEADER]: 'b'.repeat(48) },
        token,
        4319,
      ),
    ).toBe('missing or wrong token');
    expect(checkActionHeaders({ origin: ok.origin }, token, 4319)).toBe(
      'missing or wrong token',
    );
  });
});
