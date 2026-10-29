// Every TypeScript stage, saved pages to dataset
export const BUILD_STAGES = [
  'pool',
  'resolve',
  'lineups',
  'aliases',
  'scores',
  'gate',
  'images',
  'dataset',
] as const;

export type BuildStage = (typeof BUILD_STAGES)[number];

export type BuildResult =
  { success: true } | { success: false; failed: BuildStage };

// One at a time; the first non-zero exit stops it
export function runStages(
  run: (stage: BuildStage) => number,
  stages: readonly BuildStage[] = BUILD_STAGES,
): BuildResult {
  for (const stage of stages) {
    if (run(stage) !== 0) return { success: false, failed: stage };
  }
  return { success: true };
}
