import { createDefaultEsmPreset } from 'ts-jest';

const preset = createDefaultEsmPreset({
  tsconfig: {
    isolatedModules: true,
  },
});

export default {
  ...preset,
  moduleNameMapper: {
    // for import statements with `"type": "module"`
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
