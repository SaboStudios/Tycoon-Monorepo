export const WINSTON_MODULE_PROVIDER = 'WINSTON_MODULE_PROVIDER';

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  log: jest.fn(),
};

export class WinstonModule {
  static forRoot = jest
    .fn()
    .mockReturnValue({
      module: WinstonModule,
      providers: [{ provide: WINSTON_MODULE_PROVIDER, useValue: mockLogger }],
      exports: [WINSTON_MODULE_PROVIDER],
    });
  static forRootAsync = jest
    .fn()
    .mockReturnValue({
      module: WinstonModule,
      providers: [{ provide: WINSTON_MODULE_PROVIDER, useValue: mockLogger }],
      exports: [WINSTON_MODULE_PROVIDER],
    });
}
export const utilities = { format: { nestLike: jest.fn() } };
