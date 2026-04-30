import { Module } from '@nestjs/common';

export class ConfigService {
  private readonly store: Record<string, any>;

  constructor(store: Record<string, any> = {}) {
    this.store = store;
  }

  get<T = any>(key: string): T {
    return this.store[key] as T;
  }
}

@Module({
  providers: [{ provide: ConfigService, useValue: new ConfigService() }],
  exports: [ConfigService],
})
export class ConfigModule {
  static forRoot = jest
    .fn()
    .mockReturnValue({
      module: ConfigModule,
      providers: [{ provide: ConfigService, useValue: new ConfigService() }],
      exports: [ConfigService],
    });
}

export const registerAs = jest.fn((token: string, factory: () => unknown) => {
  const wrappedFactory = () => factory();
  return Object.assign(wrappedFactory, { KEY: token });
});
