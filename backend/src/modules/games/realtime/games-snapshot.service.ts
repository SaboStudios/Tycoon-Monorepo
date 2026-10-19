import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game, GameStatus } from '../entities/game.entity';
import { GamePlayer } from '../entities/game-player.entity';

export const GAMES_SCHEMA_VERSION = 1;

export interface SnapshotPlayer {
  id: number;
  userId: number;
  username: string | null;
  balance: number;
  position: number;
  circle: number;
  turnOrder: number | null;
  symbol: string | null;
  inJail: boolean;
  inJailRolls: number;
  rolled: boolean;
  rolls: number;
  /** Hidden state: only ever included for the viewer's own seat. */
  chanceJailCard?: boolean;
  communityChestJailCard?: boolean;
}

export interface GamesSnapshot {
  schemaVersion: number;
  game: {
    id: number;
    code: string;
    status: GameStatus;
    mode: string;
    numberOfPlayers: number;
    nextPlayerId: number | null;
    creatorId: number;
  };
  players: SnapshotPlayer[];
  viewer: {
    userId: number;
    role: 'player' | 'spectator';
    seatId: number | null;
  };
}

/**
 * Builds player-facing snapshots for the WS `game:snapshot` event.
 *
 * Hidden card state (`Get Out of Jail Free` holdings) is redacted for every
 * seat other than the viewer's own and never included for spectators
 * (ADR-002 security: "do not leak hidden cards").
 */
@Injectable()
export class GamesSnapshotService {
  constructor(
    @InjectRepository(Game)
    private readonly gameRepository: Repository<Game>,
    @InjectRepository(GamePlayer)
    private readonly playerRepository: Repository<GamePlayer>,
  ) {}

  async build(
    gameId: number,
    viewer: {
      userId: number;
      role: 'player' | 'spectator';
      seatId: number | null;
    },
  ): Promise<GamesSnapshot> {
    const game = await this.gameRepository.findOne({
      where: { id: gameId },
      select: [
        'id',
        'code',
        'status',
        'mode',
        'number_of_players',
        'next_player_id',
        'creator_id',
      ],
    });
    if (!game) {
      throw new Error(`Game ${gameId} not found while building snapshot`);
    }

    const players = await this.playerRepository.find({
      where: { game_id: gameId },
      relations: ['user'],
      order: { turn_order: 'ASC', id: 'ASC' },
    });

    const playersView: SnapshotPlayer[] = players.map((p) => {
      const isOwnSeat = viewer.seatId !== null && p.id === viewer.seatId;
      const base: SnapshotPlayer = {
        id: p.id,
        userId: p.user_id,
        username: p.user?.username ?? null,
        balance: Number(p.balance),
        position: p.position,
        circle: p.circle,
        turnOrder: p.turn_order,
        symbol: p.symbol ?? null,
        inJail: p.in_jail,
        inJailRolls: p.in_jail_rolls,
        rolled: p.rolled === 1,
        rolls: p.rolls,
      };
      if (isOwnSeat) {
        base.chanceJailCard = p.chance_jail_card;
        base.communityChestJailCard = p.community_chest_jail_card;
      }
      return base;
    });

    return {
      schemaVersion: GAMES_SCHEMA_VERSION,
      game: {
        id: game.id,
        code: game.code,
        status: game.status,
        mode: game.mode as string,
        numberOfPlayers: game.number_of_players,
        nextPlayerId: game.next_player_id,
        creatorId: game.creator_id,
      },
      players: playersView,
      viewer: {
        userId: viewer.userId,
        role: viewer.role,
        seatId: viewer.seatId,
      },
    };
  }

  /**
   * Room-wide state after a server-authoritative action: public state only —
   * no hidden card flags, because one broadcast serves seats and spectators.
   */
  async buildPublicState(gameId: number): Promise<{
    schemaVersion: number;
    game: GamesSnapshot['game'];
    players: SnapshotPlayer[];
  }> {
    const snapshot = await this.build(gameId, {
      userId: 0,
      role: 'spectator',
      seatId: null,
    });
    return {
      schemaVersion: snapshot.schemaVersion,
      game: snapshot.game,
      players: snapshot.players,
    };
  }

  async findSeat(gameId: number, userId: number): Promise<GamePlayer | null> {
    return this.playerRepository.findOne({
      where: { game_id: gameId, user_id: userId },
    });
  }
}
