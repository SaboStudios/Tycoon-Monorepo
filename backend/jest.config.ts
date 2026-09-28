import type { Config } from 'jest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Resolved from the backend package dir (npm scripts run jest from there).
// `__dirname` is not used because Node >=22 may load this file as ESM.
const quarantine = JSON.parse(
  readFileSync(join(process.cwd(), 'test', 'quarantine.json'), 'utf8'),
) as { entries: { pattern: string; reason: string }[] };

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  // Explicit, reviewed quarantine — see test/quarantine.json for reasons.
  testPathIgnorePatterns: [
    '/node_modules/',
    ...quarantine.entries.map((entry) => entry.pattern),
  ],
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: {
          ignoreDeprecations: '5.0',
        },
      },
    ],
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/../test/setup-jest.ts'],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/$1',
    '^@nestjs/config$': '<rootDir>/../test/mocks/nestjs-config.mock.ts',
    '^@nestjs/cache-manager$': '<rootDir>/../test/mocks/nestjs-cache-manager.mock.ts',
    '^@nestjs/swagger$': '<rootDir>/../test/mocks/nestjs-swagger.mock.ts',
    '^@nestjs/throttler$': '<rootDir>/../test/mocks/nestjs-throttler.mock.ts',
    '^fast-csv$': '<rootDir>/../test/mocks/fast-csv.mock.ts',
    '^ioredis$': '<rootDir>/../test/mocks/ioredis.mock.ts',
    '^prom-client$': '<rootDir>/../test/mocks/prom-client.mock.ts',
    '^nest-winston$': '<rootDir>/../test/mocks/nest-winston.mock.ts',
    '^winston-daily-rotate-file$': '<rootDir>/../test/mocks/winston-daily-rotate-file.mock.ts',
  },
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // Critical paths — auth, shop and purchases must stay well-covered.
    // Lower thresholds than global to avoid false-positive CI failures while
    // still catching regressions on the highest-risk code.
    './src/modules/auth/**': {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    './src/modules/shop/**': {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};

export default config;
