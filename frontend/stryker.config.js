// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  packageManager: 'npm',
  reporters: ['html', 'clear-text'],
  testRunner: 'vitest',
  coverageAnalysis: 'perTest',
  ignoreStatic: true,
  // Intentionally scoped to core validation files for focused mutation testing performance
  mutate: [
    'src/utils/validation.ts',
    'src/utils/toursValidation.ts',
  ],
}

export default config

