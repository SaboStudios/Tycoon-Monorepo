export const CACHE_MANAGER = 'CACHE_MANAGER';
const cacheManagerMock = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

export class CacheModule {
  static register = jest
    .fn()
    .mockReturnValue({
      module: CacheModule,
      providers: [{ provide: CACHE_MANAGER, useValue: cacheManagerMock }],
      exports: [CACHE_MANAGER],
    });
  static registerAsync = jest
    .fn()
    .mockReturnValue({
      module: CacheModule,
      providers: [{ provide: CACHE_MANAGER, useValue: cacheManagerMock }],
      exports: [CACHE_MANAGER],
    });
}

export const CacheInterceptor = class {};
