import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NearService } from './near.service';

describe('NearService', () => {
  let service: NearService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'near.rpcEndpoints') return ['http://rpc1.test', 'http://rpc2.test'];
      if (key === 'near.timeoutMs') return 1000;
      return null;
    }),
  };

  beforeEach(async () => {
    global.fetch = jest.fn();
    (global as any).AbortController = jest.fn(() => ({
      abort: jest.fn(),
      signal: 'mock-signal',
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NearService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<NearService>(NearService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should successfully make a view call on the first endpoint', async () => {
    const mockRpcResponse = {
      json: jest.fn().mockResolvedValue({
        result: {
          result: Array.from(Buffer.from(JSON.stringify({ success: true }))),
        },
      }),
      ok: true,
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockRpcResponse);

    const result = await service.view('contract.testnet', 'get_status', {});

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://rpc1.test',
      expect.objectContaining({ method: 'POST' })
    );
    expect(result).toEqual({ success: true });
  });

  it('should rotate endpoint on network failure and succeed on second', async () => {
    // First call fails (e.g. ECONNREFUSED)
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));
    
    // Second call succeeds
    const mockRpcResponse = {
      json: jest.fn().mockResolvedValue({
        result: {
          result: Array.from(Buffer.from(JSON.stringify({ amount: 100 }))),
        },
      }),
      ok: true,
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockRpcResponse);

    const result = await service.view('contract.testnet', 'get_balance', {});

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(1, 'http://rpc1.test', expect.any(Object));
    expect(global.fetch).toHaveBeenNthCalledWith(2, 'http://rpc2.test', expect.any(Object));
    expect(result).toEqual({ amount: 100 });
  });

  it('should throw an error if all endpoints fail', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Timeout Error'));

    await expect(service.view('contract.testnet', 'get_status', {})).rejects.toThrow(
      /All NEAR RPC endpoints failed/
    );

    expect(global.fetch).toHaveBeenCalledTimes(2); // Since there are 2 endpoints configured
  });

  it('should not rotate if it is a contract error (FunctionCallError)', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        error: { message: 'FunctionCallError: method not found' }
      })
    });

    await expect(service.view('contract.testnet', 'bad_method', {})).rejects.toThrow(
      /FunctionCallError: method not found/
    );

    expect(global.fetch).toHaveBeenCalledTimes(1); // No rotation for contract error!
  });
});
