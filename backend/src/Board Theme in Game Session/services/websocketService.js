// WebSocket Service
// Handles real-time broadcasting to game players

class WebSocketService {
  constructor() {
    this.gameRooms = new Map(); // gameId -> Set of socket connections
  }

  addPlayerToGame(gameId, socket) {
    if (!this.gameRooms.has(gameId)) {
      this.gameRooms.set(gameId, new Set());
    }
    this.gameRooms.get(gameId).add(socket);
  }

  removePlayerFromGame(gameId, socket) {
    const room = this.gameRooms.get(gameId);
    if (room) {
      room.delete(socket);
      if (room.size === 0) {
        this.gameRooms.delete(gameId);
      }
    }
  }

  async broadcastToGame(gameId, message) {
    const room = this.gameRooms.get(gameId);
    if (!room) {
      // eslint-disable-next-line no-console
      console.warn(`No active connections for game ${gameId}`);
      return;
    }

    const messageStr = JSON.stringify(message);

    room.forEach((socket) => {
      if (socket.readyState === 1) {
        // WebSocket.OPEN
        socket.send(messageStr);
      }
    });

    // eslint-disable-next-line no-console
    console.log(`Broadcasted to ${room.size} players in game ${gameId}`);
  }

  handleConnection(socket, gameId, _userId) {
    this.addPlayerToGame(gameId, socket);

    socket.on('close', () => {
      this.removePlayerFromGame(gameId, socket);
    });

    // Send current game state including theme
    this.sendGameState(socket, gameId);
  }

  async sendGameState(_socket, _gameId) {
    // Implementation would fetch current game state from DB
    // and send to the newly connected player
  }
}

module.exports = WebSocketService;
