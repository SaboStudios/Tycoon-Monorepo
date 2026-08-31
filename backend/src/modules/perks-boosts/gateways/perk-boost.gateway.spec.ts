import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PerkBoostGateway } from './perk-boost.gateway';
import { PerksBoostsEvents } from '../services/perks-boosts-events.service';
import { getWsCorsConfig } from '../../../config/ws.config';

describe('PerkBoostGateway - auth (#1296)', () => {
  let gateway: PerkBoostGateway;
  let jwtService: { verifyAsync: jest.Mock };

  function makeSocket(overrides: Record<string, any> = {}) {
    return {
      id: 'socket-1',
      handshake: { auth: {}, headers: {}, query: {} },
      data: {},
      join: jest.fn(),
      disconnect: jest.fn(),
      ...overrides,
    };
  }

  beforeEach(async () => {
    jwtService = { verifyAsync: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerkBoostGateway,
        {
          provide: PerksBoostsEvents,
          useValue: { events$: { subscribe: jest.fn() } },
        },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    gateway = module.get<PerkBoostGateway>(PerkBoostGateway);
  });

  it('disconnects sockets with no token', async () => {
    const socket = makeSocket();
    await gateway.handleConnection(socket as any);
    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('disconnects sockets with an invalid/expired token', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid token'));
    const socket = makeSocket({
      handshake: { auth: { token: 'bad-token' }, headers: {}, query: {} },
    });

    await gateway.handleConnection(socket as any);
    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('joins the room derived from the verified token, not a client-supplied userId', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: 42 });
    const socket = makeSocket({
      handshake: {
        auth: { token: 'good-token' },
        headers: {},
        query: { userId: '999' },
      },
    });

    await gateway.handleConnection(socket as any);
    expect(socket.join).toHaveBeenCalledWith('user_42');
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('accepts a bearer token from the Authorization header as a fallback', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: 7 });
    const socket = makeSocket({
      handshake: {
        auth: {},
        headers: { authorization: 'Bearer good-token' },
        query: {},
      },
    });

    await gateway.handleConnection(socket as any);
    expect(socket.join).toHaveBeenCalledWith('user_7');
  });
});

describe('PerkBoostGateway - CORS (#1428)', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should not use wildcard (*) as default CORS origin', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.WS_CORS_ORIGINS;
    delete process.env.CORS_ORIGIN;

    const config = getWsCorsConfig();
    expect(config.origin).not.toContain('*');
    expect(Array.isArray(config.origin) || typeof config.origin === 'string').toBe(true);
  });

  it('should use configured WS_CORS_ORIGINS', () => {
    process.env.WS_CORS_ORIGINS = 'https://app.example.com,https://www.example.com';
    process.env.NODE_ENV = 'development';

    const config = getWsCorsConfig();
    expect(config.origin).toEqual([
      'https://app.example.com',
      'https://www.example.com',
    ]);
  });

  it('should reject wildcard origin in production', () => {
    process.env.WS_CORS_ORIGINS = '*';
    process.env.NODE_ENV = 'production';

    expect(() => getWsCorsConfig()).toThrow(
      expect.stringMatching(/wildcard.*production/i),
    );
  });

  it('should require origins in production', () => {
    process.env.WS_CORS_ORIGINS = '';
    process.env.NODE_ENV = 'production';

    expect(() => getWsCorsConfig()).toThrow(
      expect.stringMatching(/must be configured.*production/i),
    );
  });
});
