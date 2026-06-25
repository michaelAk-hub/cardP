/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Resolve the shared workspace from source so tests run without a build step.
  moduleNameMapper: {
    '^@blue-card/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
};
