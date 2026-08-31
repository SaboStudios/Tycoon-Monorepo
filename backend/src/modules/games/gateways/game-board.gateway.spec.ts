import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { GameBoardGateway, GameBoardEvent } from './game-board.gateway';
import { Socket, Server } from 'socket.io';

describe('GameBoardGateway', () => {
  let gateway: GameBoardGateway;
  let jwtService: jest.Mocked<JwtService>;

  const mockSocket = {
    id: 'socket-123',
    disconnect: jest.fn(),
    join: jest.fn(),
    data: {} as any,
    handshake: {
      auth: {},
      headers: {},
    } as any,
  };

  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameBoardGateway,
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn(),
          },
        },
      ],
    }).compile();

    gateway = module.get<GameBoardGateway>(GameBoardGateway);
    jwtService = module.get(JwtService) as jest.Mocked<JwtService>;
    gateway.server = mockServer as unknown as Server;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleConnection', () => {
    it('should accept connection with valid JWT token in handshake.auth', async () => {
      const client = {
        ...mockSocket,
        handshake: {
          auth: { token: 'valid-token' },
          headers: {},
        },
      } as unknown as Socket;

      jwtService.verifyAsync.mockResolvedValue({
        sub: 42,
      } as any);

      await gateway.handleConnection(client);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-token');
      expect(client.data.userId).toBe(42);
    });

    it('should accept connection with valid JWT in Authorization header', async () => {
      const client = {
        ...mockSocket,
        handshake: {
          auth: {},
          headers: { authorization: 'Bearer valid-token' },
        },
        disconnect: jest.fn(),
      } as unknown as Socket;

      jwtService.verifyAsync.mockResolvedValue({
        sub: 99,
      } as any);

      await gateway.handleConnection(client);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-token');
      expect(client.data.userId).toBe(99);
    });

    it('should reject connection without token', async () => {
      const client = {
        ...mockSocket,
        handshake: {
          auth: {},
          headers: {},
        },
        disconnect: jest.fn(),
      } as unknown as Socket;

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    });

    it('should reject connection with invalid token', async () => {
      const client = {
        ...mockSocket,
        handshake: {
          auth: { token: 'invalid-token' },
          headers: {},
        },
        disconnect: jest.fn(),
      } as unknown as Socket;

      jwtService.verifyAsync.mockRejectedValue(
        new Error('Invalid signature'),
      );

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('handleJoin', () => {
    it('should add client to game room and broadcast join event', () => {
      const client = {
        ...mockSocket,
        data: { userId: 42, gameId: undefined },
      } as unknown as Socket;

      gateway.handleJoin(client, { gameId: 100 });

      expect(client.join).toHaveBeenCalledWith('game_100');
      expect(mockServer.to).toHaveBeenCalledWith('game_100');
      expect(mockServer.emit).toHaveBeenCalledWith(
        GameBoardEvent.JOIN,
        expect.objectContaining({
          userId: 42,
          gameId: 100,
        }),
      );
    });
  });

  describe('handleRoll', () => {
    it('should broadcast roll event to game room', () => {
      const client = {
        ...mockSocket,
        data: { userId: 42, gameId: 100 },
      } as unknown as Socket;

      gateway.handleRoll(client, { gameId: 100, diceValue: 6 });

      expect(mockServer.to).toHaveBeenCalledWith('game_100');
      expect(mockServer.emit).toHaveBeenCalledWith(
        GameBoardEvent.ROLL,
        expect.objectContaining({
          userId: 42,
          gameId: 100,
          diceValue: 6,
        }),
      );
    });

    it('should ignore roll from player not in a game', () => {
      const client = {
        ...mockSocket,
        data: { userId: 42, gameId: undefined },
      } as unknown as Socket;

      gateway.handleRoll(client, { gameId: 100, diceValue: 6 });

      expect(mockServer.emit).not.toHaveBeenCalled();
    });
  });

  describe('handleTurn', () => {
    it('should broadcast turn event to game room', () => {
      const client = {
        ...mockSocket,
        data: { userId: 42, gameId: 100 },
      } as unknown as Socket;

      gateway.handleTurn(client, { gameId: 100, nextPlayerId: 50 });

      expect(mockServer.to).toHaveBeenCalledWith('game_100');
      expect(mockServer.emit).toHaveBeenCalledWith(
        GameBoardEvent.TURN,
        expect.objectContaining({
          gameId: 100,
          nextPlayerId: 50,
        }),
      );
    });
  });

  describe('handleDisconnect', () => {
    it('should broadcast disconnect event to game room', () => {
      const client = {
        ...mockSocket,
        data: { userId: 42, gameId: 100 },
      } as unknown as Socket;

      gateway.handleDisconnect(client);

      expect(mockServer.to).toHaveBeenCalledWith('game_100');
      expect(mockServer.emit).toHaveBeenCalledWith(
        GameBoardEvent.DISCONNECT,
        expect.objectContaining({
          userId: 42,
          gameId: 100,
        }),
      );
    });

    it('should not emit disconnect event if not in a game', () => {
      const client = {
        ...mockSocket,
        data: { userId: 42 },
      } as unknown as Socket;

      gateway.handleDisconnect(client);

      expect(mockServer.emit).not.toHaveBeenCalled();
    });
  });
});
