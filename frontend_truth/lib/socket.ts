import { io, Socket } from "socket.io-client";
import {
  GameCreatedData,
  PlayerJoinedData,
  PlayerLeftData,
  PositionChangedData,
  GameReadyData,
  GameStartedData,
  GameEndedData,
} from "@/types/socket";

class SocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;

  connect(serverUrl: string): Socket {
    if (!this.socket) {
      this.socket = io(serverUrl, {
        transports: ["websocket"],
        autoConnect: true,
      });

      this.socket.on("connect", () => {
        console.log("Connected to server");
        this.isConnected = true;
      });

      this.socket.on("disconnect", () => {
        console.log("Disconnected from server");
        this.isConnected = false;
      });

      this.socket.on("connect_error", (error: Error) => {
        console.error("Connection error:", error);
        this.isConnected = false;
      });
    }
    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  joinGameRoom(gameCode: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("join-game-room", gameCode);
    }
  }

  leaveGameRoom(gameCode: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("leave-game-room", gameCode);
    }
  }

  // Event listeners with proper typing
  onGameCreated(callback: (data: GameCreatedData) => void): void {
    if (this.socket) {
      this.socket.on("game-created", callback);
    }
  }

  onPlayerJoined(callback: (data: PlayerJoinedData) => void): void {
    if (this.socket) {
      this.socket.on("player-joined", callback);
    }
  }

  onPlayerLeft(callback: (data: PlayerLeftData) => void): void {
    if (this.socket) {
      this.socket.on("player-left", callback);
    }
  }

  onPositionChanged(callback: (data: PositionChangedData) => void): void {
    if (this.socket) {
      this.socket.on("position-changed", callback);
    }
  }

  onGameReady(callback: (data: GameReadyData) => void): void {
    if (this.socket) {
      this.socket.on("game-ready", callback);
    }
  }

  onGameStarted(callback: (data: GameStartedData) => void): void {
    if (this.socket) {
      this.socket.on("game-started", callback);
    }
  }

  onGameEnded(callback: (data: GameEndedData) => void): void {
    if (this.socket) {
      this.socket.on("game-ended", callback);
    }
  }

  /** Emitted by backend when game state changes; client should refetch game data. */
  onGameUpdate(callback: (data: { gameCode: string }) => void): void {
    if (this.socket) {
      this.socket.on("game-update", callback);
    }
  }

  onVoteCast(callback: (data: { target_user_id: number; voter_user_id: number; vote_count: number; required_votes: number; removed: boolean }) => void): void {
    if (this.socket) {
      this.socket.on("vote-cast", callback);
    }
  }

  onEndByNetWorthVote(callback: (data: { vote_count: number; required_votes: number; voters: Array<{ user_id: number; username: string }> }) => void): void {
    if (this.socket) {
      this.socket.on("end-by-networth-vote", callback);
    }
  }

  // Remove event listeners
  removeListener(event: string, callback: (...args: any[]) => void): void {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  removeAllListeners(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  getIsConnected(): boolean {
    return this.isConnected;
  }
}

export const socketService = new SocketService();
