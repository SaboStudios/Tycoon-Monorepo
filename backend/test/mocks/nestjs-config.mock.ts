export class ConfigService {
  private readonly store: Record<string, any>;

  constructor(store: Record<string, any> = {}) {
    this.store = store;
  }

  get<T = any>(key: string): T {
    return this.store[key] as T;
  }
}

export const ConfigModule = {
  forRoot: jest.fn().mockReturnValue({ module: class ConfigModule {} }),
};
