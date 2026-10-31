import type { ActionId, Step } from '@/dashboard/actions.js';

export type Stream = 'out' | 'err';

// Runs one argv by lines; resolves its exit code
export type Spawner = (
  argv: readonly string[],
  onLine: (line: string, stream: Stream) => void,
) => Promise<number>;

export const TAIL_LINES = 60;

export interface RunResult {
  id: ActionId;
  label: string;
  startedAt: string;
  endedAt: string;
  exitCode: number;
  // The step that exited non-zero, if any
  failedStep: string | null;
  tail: string[];
  // Output of the last step that ran
  lastStep: { label: string; lines: string[] };
}

export type RunEvent =
  | { type: 'start'; id: ActionId; label: string }
  | { type: 'step'; id: ActionId; label: string }
  | { type: 'line'; id: ActionId; stream: Stream; text: string }
  | { type: 'end'; result: RunResult };

export interface Running {
  id: ActionId;
  label: string;
  step: string;
  startedAt: string;
}

export type StartResult =
  | { success: true; done: Promise<RunResult> }
  | { success: false; error: string };

export class Runner {
  private current: Running | null = null;
  private readonly last = new Map<ActionId, RunResult>();
  private readonly listeners = new Set<(event: RunEvent) => void>();

  constructor(
    private readonly spawn: Spawner,
    private readonly now: () => Date = () => new Date(),
  ) {}

  get running(): Running | null {
    return this.current;
  }

  lastResults(): RunResult[] {
    return [...this.last.values()];
  }

  subscribe(listener: (event: RunEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // One action at a time: a second start is refused
  start(id: ActionId, label: string, steps: readonly Step[]): StartResult {
    if (this.current) {
      return {
        success: false,
        error: `${this.current.label} is running`,
      };
    }
    const startedAt = this.now().toISOString();
    this.current = { id, label, step: steps[0]?.label ?? '', startedAt };
    this.emit({ type: 'start', id, label });
    const done = this.run(id, label, steps, startedAt).finally(() => {
      this.current = null;
    });
    return { success: true, done };
  }

  private async run(
    id: ActionId,
    label: string,
    steps: readonly Step[],
    startedAt: string,
  ): Promise<RunResult> {
    const tail: string[] = [];
    let lastStep = { label: '', lines: [] as string[] };
    let exitCode = 0;
    let failedStep: string | null = null;
    for (const step of steps) {
      if (this.current) this.current.step = step.label;
      this.emit({ type: 'step', id, label: step.label });
      lastStep = { label: step.label, lines: [] };
      const lines = lastStep.lines;
      exitCode = await this.spawn(step.argv, (text, stream) => {
        lines.push(text);
        tail.push(text);
        if (tail.length > TAIL_LINES) tail.shift();
        this.emit({ type: 'line', id, stream, text });
      }).catch(() => 1);
      if (exitCode !== 0) {
        failedStep = step.label;
        break;
      }
    }
    const result: RunResult = {
      id,
      label,
      startedAt,
      endedAt: this.now().toISOString(),
      exitCode,
      failedStep,
      tail,
      lastStep,
    };
    this.last.set(id, result);
    // Free before `end`, so a reload sees it idle
    this.current = null;
    this.emit({ type: 'end', result });
    return result;
  }

  private emit(event: RunEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
