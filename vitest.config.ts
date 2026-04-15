import babel, { defineRolldownBabelPreset } from '@rolldown/plugin-babel';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  oxc: {
    target: 'es2023',
  },
  // Oxc does not yet handle the decorator syntax used by these tests.
  plugins: [
    babel({
      presets: [
        defineRolldownBabelPreset({
          preset: () => ({
            plugins: [['@babel/plugin-proposal-decorators', { version: '2023-11' }]],
          }),
          rolldown: {
            filter: {
              code: '@',
            },
          },
        }),
      ],
    }),
  ],
  test: {
    globals: true,
    maxWorkers: 1,
    testTimeout: 10 * 60_000,
  },
});
