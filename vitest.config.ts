import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the tsconfig @/ path alias
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
  },
});
