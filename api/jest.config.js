const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('./tsconfig');

module.exports = {
  displayName: 'api',
  globals: {
    'ts-jest': {
      tsconfig: './tsconfig.spec.json',
    },
  },
  transform: {
    '^.+\\.[tj]s$': 'ts-jest',
  },
  "testRegex": ".*\\.(spec|e2e-spec)\\.ts$",
  "modulePaths": ["<rootDir>/src", "<rootDir>/src/"],
  // 'moduleNameMapper' important to map some 'paths' from tsconfig.json for jest.
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/' } ),
  moduleFileExtensions: ['ts', 'js'],
  collectCoverage: true,
  collectCoverageFrom: [
    "**/*.(t|j)s"
  ],
  coverageDirectory: '../coverage/api',
  coverageReporters: [
    "text",
    "lcov",
    "cobertura"
  ],
  testResultsProcessor: "jest-sonar-reporter",
  testEnvironment: "node",

  // configure `resetMocks` and `restoreMocks` to automatically reset/restor mock state before every test.
  // Jest doc isn't quite clear about the difference. But, with 'Spy's, `restoreMocks` will 
  // restores their initial implementation.
  resetMocks: true,
  restoreMocks: true
};
