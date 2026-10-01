import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from './entities/game.entity';
import { GameSettings } from './entities/game-settings.entity';
import { GamePlayer } from './entities/game-player.entity';
import { GamePlayersService } from './game-players.service';
import { GamesService } from './games.service';
import { GamesController } from './games.controller';
import { SeatOwnershipGuard } from './guards/seat-ownership.guard';
import { PerksBoostsModule } from '../perks-boosts/perks-boosts.module';
import { MetricsModule } from '../metrics/metrics.module';
import { User } from '../users/entities/user.entity';
import { GameActionIdempotencyService } from './realtime/game-action-idempotency.service';
import { GamesGateway } from './realtime/games.gateway';
import { GamesRealtimeBridge } from './realtime/games-realtime.bridge';
import { GamesSnapshotService } from './realtime/games-snapshot.service';
import { GamesWsExceptionFilter } from './realtime/games-ws-exception.filter';
import { GamesWsMetrics } from './realtime/games-ws-metrics.service';
import { WsAuthService } from './realtime/ws-auth.service';
import { WsJwtGuard } from './realtime/ws-jwt.guard';
import { WsRateLimiterService } from './realtime/ws-rate-limiter.service';

/**
 * Games module. The WebSocket gateway registers its own JwtModule (same
 * config as AuthModule) instead of importing AuthModule, because
 * AuthModule → UsersModule → GamesModule would otherwise form a cycle.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Game, GameSettings, GamePlayer, User]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret') || 'default-secret',
        signOptions: {
          expiresIn: configService.get<number>('jwt.expiresIn') || 900,
        },
        verifyOptions: {
          clockTolerance: configService.get<number>('jwt.clockTolerance') || 60,
        },
      }),
    }),
    MetricsModule,
    forwardRef(() => PerksBoostsModule),
  ],
  // GamePlayersController is intentionally not registered: its routes are
  // dormant (never wired to a module). It carries JwtAuthGuard +
  // SeatOwnershipGuard so it stays safe if it is wired later.
  controllers: [GamesController],
  providers: [
    GamePlayersService,
    GamesService,
    SeatOwnershipGuard,
    // Realtime (/games namespace)
    GamesGateway,
    GamesRealtimeBridge,
    WsAuthService,
    WsJwtGuard,
    WsRateLimiterService,
    GameActionIdempotencyService,
    GamesSnapshotService,
    GamesWsMetrics,
    GamesWsExceptionFilter,
  ],
  exports: [GamePlayersService, GamesService, GamesRealtimeBridge],
})
export class GamesModule {}
