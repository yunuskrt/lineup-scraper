import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// Disposable Neon branches only (standards)
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    root: './',
    include: ['src/**/*.e2e-spec.ts'],
    // Neon round-trips, one test after another
    testTimeout: 180_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
