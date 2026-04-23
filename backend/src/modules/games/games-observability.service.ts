import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Counter, Histogram, Gauge } from 'prom-client';
import { GameStatus } from './entities/game.entity';

@Injectable()
export class GamesObservabilityService {
  private readonly logger = new Logger(GamesObservabilityService.name);

  // Game operation metrics
  private readonly gamesCreatedTotal: Counter;
  private readonly gamesJoinedTotal: Counter;
  private readonly gamesUpdatedTotal: Counter;
  private readonly gameOperationsDuration: Histogram;
  private readonly activeGamesGauge: Gauge;
  private readonly playersInGamesGauge: Gauge;

  // Game code generation metrics
  private readonly gameCodeGenerationAttempts: Counter;
  private readonly gameCodeGenerationFailures: Counter;

  constructor(private readonly configService: ConfigService) {
    // Initialize game-specific metrics
    this.gamesCreatedTotal = new Counter({
      name: 'tycoon_games_created_total',
      help: 'Total number of games created by mode and AI status',
      labelNames: ['mode', 'is_ai', 'is_minipay', 'chain'],
    });

    this.gamesJoinedTotal = new Counter({
      name: 'tycoon_games_joined_total',
      help: 'Total number of game join attempts by result',
      labelNames: ['result', 'reason'],
    });

    this.gamesUpdatedTotal = new Counter({
      name: 'tycoon_games_updated_total',
      help: 'Total number of game updates by field',
      labelNames: ['field', 'status_transition'],
    });

    this.gameOperationsDuration = new Histogram({
      name: 'tycoon_game_operations_duration_seconds',
      help: 'Duration of game operations in seconds',
      labelNames: ['operation'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    });

    this.activeGamesGauge = new Gauge({
      name: 'tycoon_active_games',
      help: 'Number of active games by status',
      labelNames: ['status'],
    });

    this.playersInGamesGauge = new Gauge({
      name: 'tycoon_players_in_games',
      help: 'Total number of players currently in games',
    });

    this.gameCodeGenerationAttempts = new Counter({
      name: 'tycoon_game_code_generation_attempts_total',
      help: 'Total attempts to generate unique game codes',
    });

    this.gameCodeGenerationFailures = new Counter({
      name: 'tycoon_game_code_generation_failures_total',
      help: 'Total failures to generate unique game codes',
    });
  }

  /**
   * Log game creation with structured data
   */
  logGameCreation(gameData: any, creatorId: number, duration: number) {
    const labels = {
      mode: gameData.mode,
      is_ai: gameData.is_ai?.toString() || 'false',
      is_minipay: gameData.is_minipay?.toString() || 'false',
      chain: gameData.chain || 'none',
    };

    this.gamesCreatedTotal.inc(labels);
    this.gameOperationsDuration.observe({ operation: 'create' }, duration);

    this.logger.log('Game created successfully', {
      event: 'game_created',
      game_id: gameData.id,
      game_code: gameData.code,
      creator_id: creatorId,
      mode: gameData.mode,
      number_of_players: gameData.number_of_players,
      is_ai: gameData.is_ai,
      is_minipay: gameData.is_minipay,
      chain: gameData.chain,
      duration_ms: duration * 1000,
    });
  }

  /**
   * Log game join attempts and results
   */
  logGameJoin(gameId: number, userId: number, result: 'success' | 'error', reason?: string, duration?: number) {
    const labels = { result, reason: reason || 'none' };
    this.gamesJoinedTotal.inc(labels);

    if (duration !== undefined) {
      this.gameOperationsDuration.observe({ operation: 'join' }, duration);
    }

    const logLevel = result === 'success' ? 'log' : 'warn';
    this.logger[logLevel](`Game join ${result}`, {
      event: 'game_join',
      game_id: gameId,
      user_id: userId,
      result,
      reason,
      duration_ms: duration ? duration * 1000 : undefined,
    });
  }

  /**
   * Log game updates
   */
  logGameUpdate(gameId: number, updates: any, userId: number, userRole: string, duration: number) {
    const fields = Object.keys(updates);
    const isStatusTransition = updates.status !== undefined;
    
    this.gamesUpdatedTotal.inc({
      field: fields.join(','),
      status_transition: isStatusTransition.toString(),
    });

    this.gameOperationsDuration.observe({ operation: 'update' }, duration);

    this.logger.log('Game updated successfully', {
      event: 'game_updated',
      game_id: gameId,
      updated_by: userId,
      user_role: userRole,
      fields_updated: fields,
      duration_ms: duration * 1000,
    });
  }

  /**
   * Log game code generation attempts
   */
  logGameCodeGenerationAttempt(attempts: number, success: boolean) {
    this.gameCodeGenerationAttempts.inc();
    
    if (!success) {
      this.gameCodeGenerationFailures.inc();
    }

    this.logger.debug('Game code generation attempt', {
      event: 'game_code_generation',
      attempts,
      success,
    });
  }

  /**
   * Update active games metrics
   */
  updateActiveGamesMetrics(gameCounts: Record<GameStatus, number>, totalPlayers: number) {
    // Update gauge for each status
    Object.entries(gameCounts).forEach(([status, count]) => {
      this.activeGamesGauge.set({ status }, count);
    });

    this.playersInGamesGauge.set(totalPlayers);

    this.logger.debug('Updated active games metrics', {
      event: 'games_metrics_updated',
      game_counts: gameCounts,
      total_players: totalPlayers,
    });
  }

  /**
   * Log game search and filtering operations
   */
  logGameSearch(filters: any, resultCount: number, duration: number) {
    this.gameOperationsDuration.observe({ operation: 'search' }, duration);

    this.logger.debug('Game search performed', {
      event: 'game_search',
      filters,
      result_count: resultCount,
      duration_ms: duration * 1000,
    });
  }

  /**
   * Log game settings updates
   */
  logGameSettingsUpdate(gameId: number, userId: number, settingsUpdated: any, duration: number) {
    this.gameOperationsDuration.observe({ operation: 'update_settings' }, duration);

    this.logger.log('Game settings updated', {
      event: 'game_settings_updated',
      game_id: gameId,
      updated_by: userId,
      settings_updated: Object.keys(settingsUpdated),
      duration_ms: duration * 1000,
    });
  }

  /**
   * Log game view operations
   */
  logGameView(gameId: number | undefined, userId?: number, found: boolean) {
    this.logger.debug('Game view requested', {
      event: 'game_view',
      game_id: gameId,
      user_id: userId,
      found,
    });
  }

  /**
   * Log matchmaking operations
   */
  logMatchmakingOperation(operation: string, gameId: number, userId: number, metadata?: any) {
    this.logger.log('Matchmaking operation', {
      event: 'matchmaking',
      operation,
      game_id: gameId,
      user_id: userId,
      metadata,
    });
  }

  /**
   * Log performance metrics for game operations
   */
  logPerformanceMetric(operation: string, duration: number, metadata?: any) {
    this.gameOperationsDuration.observe({ operation }, duration);

    if (duration > 1.0) { // Log slow operations
      this.logger.warn(`Slow game operation detected: ${operation}`, {
        event: 'slow_operation',
        operation,
        duration_seconds: duration,
        metadata,
      });
    }
  }

  /**
   * Create a trace context for game operations
   */
  createTraceContext(operation: string, gameId?: number, userId?: number) {
    return {
      trace_id: this.generateTraceId(),
      operation,
      game_id: gameId,
      user_id: userId,
      timestamp: new Date().toISOString(),
    };
  }

  private generateTraceId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}
