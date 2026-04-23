import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
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
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/$1',
    '^@nestjs/config$': '<rootDir>/../test/mocks/nestjs-config.mock.ts',
    '^@nestjs/cache-manager$': '<rootDir>/../test/mocks/nestjs-cache-manager.mock.ts',
    '^prom-client$': '<rootDir>/../test/mocks/prom-client.mock.ts',
    '^ioredis$': '<rootDir>/../test/mocks/ioredis.mock.ts',
    '^nest-winston$': '<rootDir>/../test/mocks/nest-winston.mock.ts',
  },
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

export default config;
