import { Test } from '@nestjs/testing';
import { AppModule, resolveSynchronize } from './app.module';
import { HealthController } from './health/health.controller';
import { HealthModule } from './health/health.module';

describe('resolveSynchronize', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDbSynchronize = process.env.DB_SYNCHRONIZE;

  beforeEach(() => {
    jest.resetModules();
    delete process.env.NODE_ENV;
    delete process.env.DB_SYNCHRONIZE;
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalDbSynchronize === undefined) {
      delete process.env.DB_SYNCHRONIZE;
    } else {
      process.env.DB_SYNCHRONIZE = originalDbSynchronize;
    }
  });

  it('returns true when NODE_ENV is test', () => {
    process.env.NODE_ENV = 'test';

    expect(resolveSynchronize()).toBe(true);
  });

  it('throws when NODE_ENV is staging and DB_SYNCHRONIZE is true', () => {
    process.env.NODE_ENV = 'staging';
    process.env.DB_SYNCHRONIZE = 'true';

    expect(() => resolveSynchronize()).toThrow(/migration:run/);
  });

  it('returns false when NODE_ENV is staging without DB_SYNCHRONIZE', () => {
    process.env.NODE_ENV = 'staging';

    expect(resolveSynchronize()).toBe(false);
  });

  it('returns false when NODE_ENV is unset', () => {
    expect(resolveSynchronize()).toBe(false);
  });
});

describe('AppModule health wiring', () => {
  it('registers HealthController exactly once via HealthModule', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('TypeOrmModuleOptions')
      .useValue({})
      .compile();

    const healthModule = moduleRef.get(HealthModule, { strict: false });
    expect(healthModule).toBeInstanceOf(HealthModule);

    const healthController = moduleRef.get(HealthController, { strict: false });
    expect(healthController).toBeInstanceOf(HealthController);

    const controllers = (Reflect.getMetadata('controllers', HealthModule) ?? []) as unknown[];
    expect(controllers.filter((c) => c === HealthController)).toHaveLength(1);

    const appControllers = (Reflect.getMetadata('controllers', AppModule) ?? []) as unknown[];
    expect(appControllers).not.toContain(HealthController);

    await moduleRef.close();
  });
});
