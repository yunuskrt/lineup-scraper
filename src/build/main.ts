import { spawnSync } from 'node:child_process';
import { BUILD_STAGES, runStages } from '@/build/stages.js';

const result = runStages((stage) => {
  console.log(`\n== npm run ${stage}`);
  const run = spawnSync('npm', ['run', '--silent', stage], {
    stdio: 'inherit',
  });
  return run.status ?? 1;
});

if (result.success) {
  console.log(`\nbuild: all ${BUILD_STAGES.length} stages passed`);
} else {
  console.error(
    `\nbuild: npm run ${result.failed} failed; the later stages didn't run`,
  );
  process.exitCode = 1;
}
