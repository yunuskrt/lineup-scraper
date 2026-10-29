import { BUILD_STAGES, runStages, type BuildStage } from '@/build/stages.js';

describe('runStages', () => {
  it('runs every stage in pipeline order', () => {
    const ran: BuildStage[] = [];
    const result = runStages((stage) => {
      ran.push(stage);
      return 0;
    });

    expect(result).toEqual({ success: true });
    expect(ran).toEqual([
      'pool',
      'resolve',
      'lineups',
      'aliases',
      'scores',
      'gate',
      'images',
      'dataset',
    ]);
  });

  it('stops at the first failing stage and names it', () => {
    const ran: BuildStage[] = [];
    const result = runStages((stage) => {
      ran.push(stage);
      return stage === 'gate' ? 1 : 0;
    });

    expect(result).toEqual({ success: false, failed: 'gate' });
    expect(ran.at(-1)).toBe('gate');
    expect(ran).not.toContain('images');
  });

  it('runs images before dataset, which reads its keys', () => {
    expect(BUILD_STAGES.indexOf('images')).toBe(
      BUILD_STAGES.indexOf('dataset') - 1,
    );
  });
});
