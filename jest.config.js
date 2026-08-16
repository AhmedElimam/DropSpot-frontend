// Unit tests for the pure offline-buffer logic (bucketing, session matching,
// batch-result mapping). Uses the SDK-matched jest-expo preset so the @/ alias
// and TypeScript transform match the app's runtime.
module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
};
