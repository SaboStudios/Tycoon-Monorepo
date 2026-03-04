// Tests for WebSocket Service

const WebSocketService = require('../services/websocketService');

describe('WebSocketService', () => {
  let service;

  beforeEach(() => {
    service = new WebSocketService();
  });

  describe('addPlayerToGame', () => {
    test('should create new room and add player', () => {
      const mockSocket = { id: 'socket1' };

      service.addPlayerToGame(1, mockSocket);

      expect(service.gameRooms.has(1)).toBe(true);
      expect(service.gameRooms.get(1).has(mockSocket)).toBe(true);
    });

    test('should add player to existing room', () => {
      const socket1 = { id: 'socket1' };
      const socket2 = { id: 'socket2' };

      service.addPlayerToGame(1, socket1);
      service.addPlayerToGame(1, socket2);

      expect(service.gameRooms.get(1).size).toBe(2);
    });
  });

  describe('removePlayerFromGame', () => {
    test('should remove player from room', () => {
      const mockSocket = { id: 'socket1' };

      service.addPlayerToGame(1, mockSocket);
      service.removePlayerFromGame(1, mockSocket);

      expect(service.gameRooms.has(1)).toBe(false);
    });

    test('should keep room if other players remain', () => {
      const socket1 = { id: 'socket1' };
      const socket2 = { id: 'socket2' };

      service.addPlayerToGame(1, socket1);
      service.addPlayerToGame(1, socket2);
      service.removePlayerFromGame(1, socket1);

      expect(service.gameRooms.has(1)).toBe(true);
      expect(service.gameRooms.get(1).size).toBe(1);
    });

    test('should handle removing from non-existent room', () => {
      const mockSocket = { id: 'socket1' };

      expect(() => {
        service.removePlayerFromGame(999, mockSocket);
      }).not.toThrow();
    });
  });

  describe('broadcastToGame', () => {
    test('should send message to all players in room', async () => {
      const socket1 = { readyState: 1, send: jest.fn() };
      const socket2 = { readyState: 1, send: jest.fn() };

      service.addPlayerToGame(1, socket1);
      service.addPlayerToGame(1, socket2);

      const message = { type: 'THEME_UPDATED', payload: { theme: 'ocean' } };
      await service.broadcastToGame(1, message);

      expect(socket1.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(socket2.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    test('should skip closed connections', async () => {
      const socket1 = { readyState: 1, send: jest.fn() };
      const socket2 = { readyState: 3, send: jest.fn() }; // CLOSED

      service.addPlayerToGame(1, socket1);
      service.addPlayerToGame(1, socket2);

      const message = { type: 'TEST' };
      await service.broadcastToGame(1, message);

      expect(socket1.send).toHaveBeenCalled();
      expect(socket2.send).not.toHaveBeenCalled();
    });

    test('should handle non-existent room gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await service.broadcastToGame(999, { type: 'TEST' });

      expect(consoleSpy).toHaveBeenCalledWith(
        'No active connections for game 999',
      );
      consoleSpy.mockRestore();
    });
  });

  describe('handleConnection', () => {
    test('should add player and setup close handler', () => {
      const mockSocket = {
        id: 'socket1',
        on: jest.fn(),
      };

      service.sendGameState = jest.fn();
      service.handleConnection(mockSocket, 1, 'user1');

      expect(service.gameRooms.get(1).has(mockSocket)).toBe(true);
      expect(mockSocket.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(service.sendGameState).toHaveBeenCalledWith(mockSocket, 1);
    });

    test('should remove player on socket close', () => {
      const mockSocket = {
        id: 'socket1',
        on: jest.fn(),
      };

      service.sendGameState = jest.fn();
      service.handleConnection(mockSocket, 1, 'user1');

      const closeHandler = mockSocket.on.mock.calls[0][1];
      closeHandler();

      expect(service.gameRooms.has(1)).toBe(false);
    });
  });
});
