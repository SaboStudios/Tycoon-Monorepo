import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from '../entities/game.entity';
import { Player } from '../entities/player.entity';

export interface SnapshotViewer {
  userId: number;
  role: 'player' | 'spectator';
  seatId: number | null;
}

export interface SnapshotPlayer {
  id: number;
  userId: number;
  balance: string | null;
  position: number;
  circle: number;
  turnOrder: number;
  symbol: string;
  inJail: boolean;
  inJailRolls: number;
  rolled: number;
  rolls: number;
  chanceJailCard?: boolean;
  communityChestJailCard?: boolean;
  user?: { username: string };
}

export interface GameSnapshot {
  schemaVersion: number;
  game: Record<string, unknown>;
  players: SnapshotPlayer[];
  viewer?: SnapshotViewer;
}

/**
 * Serializes a player balance into an integer minor-unit string without
 * going through a binary float. Returns null when the balance is missing so
 * callers can distinguish "no money" from "unknown".
 */
function serializeBalance(balance: unknown): string | null {
  if (balance === null || balance === undefined) {
    return null;
  }
  if (typeof balance === 'bigint') {
    return balance.toString();
  }
  if (typeof balance === 'number') {
    if (!Number.isFinite(balance)) {
      return null;
    }
    return BigInt(Math.trunc(balance)).toString();
  }
  if (typeof balance === 'string') {
    const trimmed = balance.trim();
    if (!/^-?\d+$/.test(trimmed)) {
      return null;
    }
    return BigInt(trimmed).toString();
  }
  return null;
}

@Injectable()
export class GamesSnapshotService {
  constructor(
    @InjectRepository(Game)
    private readonly gameRepository: Repository<Game>,
    @InjectRepository(Player)
    private readonly playerRepository: Repository<Player>,
  ) {}

  async build(gameId: number, viewer: SnapshotViewer): Promise<GameSnapshot> {
    const game = await this.gameRepository.findOne({ where: { id: gameId } });
    const players = await this.playerRepository.find({
      where: { game_id: gameId },
      relations: ['user'],
    });

    return {
      schemaVersion: 1,
      game: this.serializeGame(game),
      players: players.map((player) =>
        this.serializePlayer(player, viewer),
      ),
      viewer,
    };
  }

  async buildPublicState(gameId: number): Promise<GameSnapshot> {
    const game = await this.gameRepository.findOne({ where: { id: gameId } });
    const players = await this.playerRepository.find({
      where: { game_id: gameId },
    });

    return {
      schemaVersion: 1,
      game: this.serializeGame(game),
      players: players.map((player) =>
        this.serializePlayer(player, null),
      ),
    };
  }

  async findSeat(gameId: number, userId: number): Promise<Player | null> {
    return this.playerRepository.findOne({
      where: { game_id: gameId, user_id: userId },
    });
  }

  private serializeGame(game: Game | null): Record<string, unknown> {
    if (!game) {
      return {};
    }
    return {
      id: game.id,
      code: game.code,
      status: game.status,
      mode: game.mode,
      numberOfPlayers: game.number_of_players,
      nextPlayerId: game.next_player_id,
      creatorId: game.creator_id,
    };
  }

  private serializePlayer(
    player: Player,
    viewer: SnapshotViewer | null,
  ): SnapshotPlayer {
    const isOwnSeat = viewer !== null && viewer.seatId === player.id;
    const snapshot: SnapshotPlayer = {
      id: player.id,
      userId: player.user_id,
      balance: serializeBalance(player.balance),
      position: player.position,
      circle: player.circle,
      turnOrder: player.turn_order,
      symbol: player.symbol,
      inJail: player.in_jail,
      inJailRolls: player.in_jail_rolls,
      rolled: player.rolled,
      rolls: player.rolls,
    };

    if (isOwnSeat) {
      snapshot.chanceJailCard = player.chance_jail_card;
      snapshot.communityChestJailCard = player.community_chest_jail_card;
    }

    if (viewer !== null && player.user) {
      snapshot.user = { username: player.user.username };
    }

    return snapshot;
  }
}
