module.exports = {
  displayName: 'public',
  preset: 'jest-preset-angular',
  setupFiles: ['<rootDir>/src/jest-global-setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  testMatch: [
    '<rootDir>/src/**/*.spec.ts',
  ],
  moduleNameMapper: {
    '^@public-core/(.*)$': '<rootDir>/src/core/$1',
    '^@api-client$': '<rootDir>/../libs/client/typescript-ng',
    '^@utility/(.*)$': '<rootDir>/../libs/utility/src/$1',
    '^app/(.*)$': '<rootDir>/src/app/$1',
  },
  coverageDirectory: '../coverage/public',
  snapshotSerializers: [
    'jest-preset-angular/build/serializers/no-ng-attributes',
    'jest-preset-angular/build/serializers/ng-snapshot',
    'jest-preset-angular/build/serializers/html-comment',
  ],
};
