import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditTrailService } from '../../audit-trail/audit-trail.service';
import { AuditAction } from '../../audit-trail/entities/audit-trail.entity';
import { GamesObservabilityService } from '../games-observability.service';
import { SensitiveDataRedactor } from './sensitive-data-redactor.service';

/**
 * Base context for all audit operations.
 * Contains common fields captured for every audit log entry.
 */
export interface BaseAuditContext {
  /** User ID who performed the operation */
  userId?: number;
  /** Game ID associated with the operation */
  gameId?: number;
  /** ISO 8601 timestamp of when the operation occurred */
  timestamp: string;
  /** Type of operation being audited */
  operation: string;
  /** IP address of the client (redacted) */
  ipAddress?: string;
  /** User agent string from the client */
  userAgent?: string;
  /** Duration of the operation in milliseconds */
  duration?: number;
}

/**
 * Context for game creation operations.
 */
export interface GameCreationContext extends BaseAuditContext {
  /** Unique game code generated for the game */
  gameCode: string;
  /** Game mode (PUBLIC, PRIVATE, etc.) */
  mode: string;
  /** Number of players allowed in the game */
  numberOfPlayers: number;
  /** Whether the game includes AI players */
  isAi: boolean;
  /** Whether the game uses Minipay */
  isMinipay: boolean;
  /** Blockchain chain identifier */
  chain?: string;
  /** Contract game ID if on-chain */
  contractGameId?: string;
  /** Game settings configuration */
  settings: {
    auction: boolean;
    rentInPrison: boolean;
    mortgage: boolean;
    evenBuild: boolean;
    randomizePlayOrder: boolean;
    startingCash: number;
  };
}

/**
 * Context for game update operations.
 */
export interface GameUpdateContext extends BaseAuditContext {
  /** Previous game status */
  previousStatus?: string;
  /** New game status */
  newStatus?: string;
  /** Fields that were updated */
  fieldsUpdated: string[];
  /** User role who performed the update */
  userRole: string;
  /** Winner ID if game was completed */
  winnerId?: number;
  /** Next player ID if turn changed */
  nextPlayerId?: number;
  /** Player placements if game ended */
  placements?: Record<string, any>;
}

/**
 * Context for game settings update operations.
 */
export interface GameSettingsUpdateContext extends BaseAuditContext {
  /** Settings fields that were updated */
  settingsUpdated: string[];
  /** Previous settings values */
  previousValues?: Record<string, any>;
  /** New settings values */
  newValues?: Record<string, any>;
}

/**
 * Context for game view operations (read-only).
 */
export interface GameViewContext extends BaseAuditContext {
  /** Whether the game was found */
  found: boolean;
  /** Game code if viewing by code */
  gameCode?: string;
}

/**
 * Context for game search operations.
 */
export interface GameSearchContext extends BaseAuditContext {
  /** Search filters applied */
  filters: Record<string, any>;
  /** Number of results returned */
  resultCount: number;
}

/**
 * Context for game join operations.
 */
export interface GameJoinContext extends BaseAuditContext {
  /** Result of the join attempt */
  result: 'success' | 'failure';
  /** Reason for failure (if applicable) */
  reason?: string;
  /** Number of players in the game after join */
  playerCountAfter?: number;
  /** Player ID created */
  playerId?: number;
  /** Wallet address used (will be redacted) */
  address?: string;
}

/**
 * Context for game leave operations.
 */
export interface GameLeaveContext extends BaseAuditContext {
  /** Player ID who left */
  playerId: number;
  /** Reason for leaving */
  reason?: string;
  /** Number of players in the game after leave */
  playerCountAfter?: number;
}

/**
 * Context for player action operations.
 */
export interface PlayerActionContext extends BaseAuditContext {
  /** Player ID who performed the action */
  playerId: number;
  /** Type of action performed */
  actionType: 'roll_dice' | 'pay_rent' | 'pay_tax' | 'buy_property' | 'update_player';
  /** Additional metadata specific to the action */
  metadata: Record<string, any>;
}

/**
 * Context for dice roll operations.
 */
export interface DiceRollContext extends BaseAuditContext {
  /** Player ID who rolled */
  playerId: number;
  /** First die value */
  dice1: number;
  /** Second die value */
  dice2: number;
  /** Total of both dice */
  total: number;
  /** Position before roll */
  previousPosition?: number;
  /** Position after roll */
  newPosition?: number;
  /** Whether doubles were rolled */
  isDoubles: boolean;
}

/**
 * Context for rent payment operations.
 */
export interface RentPaymentContext extends BaseAuditContext {
  /** Player ID who paid rent */
  payerId: number;
  /** Player ID who received rent */
  payeeId: number;
  /** Base rent amount before modifiers */
  baseRent: number;
  /** Final rent amount after modifiers */
  finalRent: number;
  /** Modifiers applied (boosts, perks, etc.) */
  modifiers?: Record<string, any>;
}

/**
 * Context for tax payment operations.
 */
export interface TaxPaymentContext extends BaseAuditContext {
  /** Player ID who paid tax */
  playerId: number;
  /** Base tax amount before modifiers */
  baseTax: number;
  /** Final tax amount after modifiers */
  finalTax: number;
  /** Modifiers applied (reductions, etc.) */
  modifiers?: Record<string, any>;
}

/**
 * Context for property purchase operations.
 */
export interface PropertyPurchaseContext extends BaseAuditContext {
  /** Player ID who bought the property */
  playerId: number;
  /** Property ID purchased */
  propertyId: string;
  /** Cost of the property */
  cost: number;
  /** Player balance before purchase */
  previousBalance?: number;
  /** Player balance after purchase */
  newBalance?: number;
}

/**
 * Central service for all game-related audit logging.
 * 
 * Coordinates between AuditTrailService (persistent database records) and
 * GamesObservabilityService (real-time metrics and structured logging).
 * 
 * Key features:
 * - Async-first: All audit operations are non-blocking
 * - Privacy by default: Sensitive data is redacted automatically
 * - Graceful degradation: Audit failures don't break main application flow
 * - Observable: Prometheus metrics for monitoring audit operations
 */
@Injectable()
export class GamesAuditService {
  private readonly logger = new Logger(GamesAuditService.name);

  constructor(
    private readonly auditTrailService: AuditTrailService,
    private readonly observabilityService: GamesObservabilityService,
    private readonly redactor: SensitiveDataRedactor,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Check if audit logging is enabled via configuration.
   * @returns true if audit logging is enabled
   */
  private isAuditEnabled(): boolean {
    return this.configService.get<boolean>('GAMES_AUDIT_ENABLED', true);
  }

  /**
   * Get the configured timeout for async audit operations.
   * @returns timeout in milliseconds
   */
  private getAsyncTimeout(): number {
    return this.configService.get<number>('GAMES_AUDIT_ASYNC_TIMEOUT_MS', 5000);
  }

  /**
   * Create a promise that rejects after the specified timeout.
   * Used to prevent audit operations from hanging indefinitely.
   * 
   * @param ms - Timeout in milliseconds
   * @returns Promise that rejects with timeout error
   */
  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Audit operation timeout')), ms);
    });
  }

  /**
   * Create a base audit context with common fields.
   * 
   * @param operation - Operation type
   * @param metadata - Additional metadata
   * @returns Base audit context
   */
  createAuditContext(operation: string, metadata?: any): BaseAuditContext {
    return {
      operation,
      timestamp: new Date().toISOString(),
      ...metadata,
    };
  }

  /**
   * Log game creation audit trail.
   * 
   * Captures: creator ID, game mode, player count, AI status, minipay status,
   * chain, settings, and operation duration.
   * 
   * @param context - Game creation context
   */
  async logGameCreation(context: GameCreationContext): Promise<void> {
    if (!this.isAuditEnabled()) {
      return;
    }

    const startTime = Date.now();

    try {
      // Redact sensitive data
      const redactedContext = this.redactor.redactObject(context);

      // Log to audit trail (async, with timeout)
      await Promise.race([
        this.auditTrailService.log(AuditAction.GAME_CREATED, {
          userId: context.userId,
          changes: redactedContext,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        }),
        this.timeout(this.getAsyncTimeout()),
      ]);

      // Log to observability service (sync, fast)
      this.observabilityService.logGameCreation(
        {
          id: context.gameId,
          code: context.gameCode,
          mode: context.mode,
          number_of_players: context.numberOfPlayers,
          is_ai: context.isAi,
          is_minipay: context.isMinipay,
          chain: context.chain,
          settings: context.settings,
        },
        context.userId!,
        (Date.now() - startTime) / 1000,
      );
    } catch (error) {
      this.logger.error('Failed to log game creation audit', {
        error: error.message,
        context: { gameId: context.gameId, userId: context.userId },
      });

      // Fallback: log to observability service only
      try {
        this.observabilityService.logGameCreation(
          {
            id: context.gameId,
            code: context.gameCode,
            mode: context.mode,
            number_of_players: context.numberOfPlayers,
            is_ai: context.isAi,
            is_minipay: context.isMinipay,
            chain: context.chain,
            settings: context.settings,
          },
          context.userId!,
          (Date.now() - startTime) / 1000,
        );
      } catch (fallbackError) {
        this.logger.error('Fallback audit logging also failed', {
          error: fallbackError.message,
        });
      }
    }
  }

  /**
   * Log game update audit trail.
   * 
   * Captures: previous status, new status, fields updated, user who triggered
   * the change, and operation duration.
   * 
   * @param context - Game update context
   */
  async logGameUpdate(context: GameUpdateContext): Promise<void> {
    if (!this.isAuditEnabled()) {
      return;
    }

    const startTime = Date.now();

    try {
      // Redact sensitive data
      const redactedContext = this.redactor.redactObject(context);

      // Log to audit trail (async, with timeout)
      await Promise.race([
        this.auditTrailService.log(AuditAction.GAME_UPDATED, {
          userId: context.userId,
          changes: redactedContext,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        }),
        this.timeout(this.getAsyncTimeout()),
      ]);

      // Log to observability service (sync, fast)
      this.observabilityService.logGameUpdate(
        context.gameId!,
        { status: context.newStatus, fields: context.fieldsUpdated },
        context.userId!,
        context.userRole,
        (Date.now() - startTime) / 1000,
      );
    } catch (error) {
      this.logger.error('Failed to log game update audit', {
        error: error.message,
        context: { gameId: context.gameId, userId: context.userId },
      });

      // Fallback: log to observability service only
      try {
        this.observabilityService.logGameUpdate(
          context.gameId!,
          { status: context.newStatus, fields: context.fieldsUpdated },
          context.userId!,
          context.userRole,
          (Date.now() - startTime) / 1000,
        );
      } catch (fallbackError) {
        this.logger.error('Fallback audit logging also failed', {
          error: fallbackError.message,
        });
      }
    }
  }

  /**
   * Log game settings update audit trail.
   * 
   * Captures: fields changed, previous values, new values, and user who made
   * the change.
   * 
   * @param context - Game settings update context
   */
  async logGameSettingsUpdate(
    context: GameSettingsUpdateContext,
  ): Promise<void> {
    if (!this.isAuditEnabled()) {
      return;
    }

    const startTime = Date.now();

    try {
      // Redact sensitive data
      const redactedContext = this.redactor.redactObject(context);

      // Log to audit trail (async, with timeout)
      await Promise.race([
        this.auditTrailService.log(AuditAction.GAME_SETTINGS_UPDATED, {
          userId: context.userId,
          changes: redactedContext,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        }),
        this.timeout(this.getAsyncTimeout()),
      ]);

      // Log to observability service (sync, fast)
      this.observabilityService.logGameSettingsUpdate(
        context.gameId!,
        context.userId!,
        context.settingsUpdated,
        (Date.now() - startTime) / 1000,
      );
    } catch (error) {
      this.logger.error('Failed to log game settings update audit', {
        error: error.message,
        context: { gameId: context.gameId, userId: context.userId },
      });

      // Fallback: log to observability service only
      try {
        this.observabilityService.logGameSettingsUpdate(
          context.gameId!,
          context.userId!,
          context.settingsUpdated,
          (Date.now() - startTime) / 1000,
        );
      } catch (fallbackError) {
        this.logger.error('Fallback audit logging also failed', {
          error: fallbackError.message,
        });
      }
    }
  }

  /**
   * Log game view audit trail (conditional on GAMES_AUDIT_LOG_VIEWS).
   * 
   * Captures: game ID, whether found, and query parameters at debug level.
   * 
   * @param context - Game view context
   */
  async logGameView(context: GameViewContext): Promise<void> {
    if (!this.isAuditEnabled()) {
      return;
    }

    // Check if view logging is enabled
    const logViews = this.configService.get<boolean>(
      'GAMES_AUDIT_LOG_VIEWS',
      false,
    );
    if (!logViews) {
      return;
    }

    const startTime = Date.now();

    try {
      // Redact sensitive data
      const redactedContext = this.redactor.redactObject(context);

      // Log to audit trail (async, with timeout)
      await Promise.race([
        this.auditTrailService.log(AuditAction.GAME_VIEWED, {
          userId: context.userId,
          changes: redactedContext,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        }),
        this.timeout(this.getAsyncTimeout()),
      ]);

      // Log to observability service (debug level)
      this.observabilityService.logGameView(
        context.gameId,
        context.found,
        context.userId,
      );
    } catch (error) {
      this.logger.debug('Failed to log game view audit', {
        error: error.message,
        context: { gameId: context.gameId, userId: context.userId },
      });
    }
  }

  /**
   * Log game join audit trail.
   * 
   * Captures: user ID, game ID, join result (success/failure), failure reason,
   * and player count after join.
   * 
   * @param context - Game join context
   */
  async logGameJoin(context: GameJoinContext): Promise<void> {
    if (!this.isAuditEnabled()) {
      return;
    }

    const startTime = Date.now();

    try {
      // Redact sensitive data (especially wallet address)
      const redactedContext = this.redactor.redactObject(context);

      // Determine audit action based on result
      const action =
        context.result === 'success'
          ? AuditAction.GAME_JOINED
          : AuditAction.GAME_JOIN_FAILED;

      // Log to audit trail (async, with timeout)
      await Promise.race([
        this.auditTrailService.log(action, {
          userId: context.userId,
          changes: redactedContext,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        }),
        this.timeout(this.getAsyncTimeout()),
      ]);

      // Log to observability service (sync, fast)
      this.observabilityService.logGameJoin(
        context.gameId!,
        context.userId!,
        context.result === 'success' ? 'success' : 'error',
        context.reason,
        (Date.now() - startTime) / 1000,
      );
    } catch (error) {
      this.logger.error('Failed to log game join audit', {
        error: error.message,
        context: { gameId: context.gameId, userId: context.userId },
      });

      // Fallback: log to observability service only
      try {
        this.observabilityService.logGameJoin(
          context.gameId!,
          context.userId!,
          context.result === 'success' ? 'success' : 'error',
          context.reason,
          (Date.now() - startTime) / 1000,
        );
      } catch (fallbackError) {
        this.logger.error('Fallback audit logging also failed', {
          error: fallbackError.message,
        });
      }
    }
  }

  /**
   * Log game leave audit trail.
   * 
   * Captures: user ID, game ID, player ID, leave reason, and player count
   * after leave.
   * 
   * @param context - Game leave context
   */
  async logGameLeave(context: GameLeaveContext): Promise<void> {
    if (!this.isAuditEnabled()) {
      return;
    }

    const startTime = Date.now();

    try {
      // Redact sensitive data
      const redactedContext = this.redactor.redactObject(context);

      // Log to audit trail (async, with timeout)
      await Promise.race([
        this.auditTrailService.log(AuditAction.GAME_LEFT, {
          userId: context.userId,
          changes: redactedContext,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        }),
        this.timeout(this.getAsyncTimeout()),
      ]);

      // Log to observability service
      this.observabilityService.logMatchmakingOperation(
        'leave_game',
        context.gameId!,
        context.userId!,
        {
          playerId: context.playerId,
          reason: context.reason,
          playerCountAfter: context.playerCountAfter,
        },
      );
    } catch (error) {
      this.logger.error('Failed to log game leave audit', {
        error: error.message,
        context: { gameId: context.gameId, userId: context.userId },
      });

      // Fallback: log to observability service only
      try {
        this.observabilityService.logMatchmakingOperation(
          'leave_game',
          context.gameId!,
          context.userId!,
          {
            playerId: context.playerId,
            reason: context.reason,
            playerCountAfter: context.playerCountAfter,
          },
        );
      } catch (fallbackError) {
        this.logger.error('Fallback audit logging also failed', {
          error: fallbackError.message,
        });
      }
    }
  }
}

  /**
   * Log generic player action audit trail.
   * 
   * Captures: player ID, game ID, action type, and metadata.
   * 
   * @param context - Player action context
   */
  async logPlayerAction(context: PlayerActionContext): Promise<void> {
    if (!this.isAuditEnabled()) {
      return;
    }

    const startTime = Date.now();

    try {
      // Redact sensitive data
      const redactedContext = this.redactor.redactObject(context);

      // Log to audit trail (async, with timeout)
      await Promise.race([
        this.auditTrailService.log(AuditAction.PLAYER_UPDATED, {
          userId: context.userId,
          changes: redactedContext,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        }),
        this.timeout(this.getAsyncTimeout()),
      ]);
    } catch (error) {
      this.logger.error('Failed to log player action audit', {
        error: error.message,
        context: { gameId: context.gameId, playerId: context.playerId },
      });
    }
  }

  /**
   * Log dice roll audit trail.
   * 
   * Captures: player ID, game ID, dice values, position change, and whether
   * doubles were rolled.
   * 
   * @param context - Dice roll context
   */
  async logDiceRoll(context: DiceRollContext): Promise<void> {
    if (!this.isAuditEnabled()) {
      return;
    }

    const startTime = Date.now();

    try {
      // Redact sensitive data
      const redactedContext = this.redactor.redactObject(context);

      // Log to audit trail (async, with timeout)
      await Promise.race([
        this.auditTrailService.log(AuditAction.PLAYER_DICE_ROLLED, {
          userId: context.userId,
          changes: redactedContext,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        }),
        this.timeout(this.getAsyncTimeout()),
      ]);
    } catch (error) {
      this.logger.error('Failed to log dice roll audit', {
        error: error.message,
        context: { gameId: context.gameId, playerId: context.playerId },
      });
    }
  }

  /**
   * Log rent payment audit trail.
   * 
   * Captures: payer ID, payee ID, base rent, final rent, and modifiers applied.
   * 
   * @param context - Rent payment context
   */
  async logRentPayment(context: RentPaymentContext): Promise<void> {
    if (!this.isAuditEnabled()) {
      return;
    }

    const startTime = Date.now();

    try {
      // Redact sensitive data
      const redactedContext = this.redactor.redactObject(context);

      // Log to audit trail (async, with timeout)
      await Promise.race([
        this.auditTrailService.log(AuditAction.PLAYER_RENT_PAID, {
          userId: context.userId,
          changes: redactedContext,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        }),
        this.timeout(this.getAsyncTimeout()),
      ]);
    } catch (error) {
      this.logger.error('Failed to log rent payment audit', {
        error: error.message,
        context: { gameId: context.gameId, payerId: context.payerId },
      });
    }
  }

  /**
   * Log tax payment audit trail.
   * 
   * Captures: player ID, base tax, final tax, and modifiers applied.
   * 
   * @param context - Tax payment context
   */
  async logTaxPayment(context: TaxPaymentContext): Promise<void> {
    if (!this.isAuditEnabled()) {
      return;
    }

    const startTime = Date.now();

    try {
      // Redact sensitive data
      const redactedContext = this.redactor.redactObject(context);

      // Log to audit trail (async, with timeout)
      await Promise.race([
        this.auditTrailService.log(AuditAction.PLAYER_TAX_PAID, {
          userId: context.userId,
          changes: redactedContext,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        }),
        this.timeout(this.getAsyncTimeout()),
      ]);
    } catch (error) {
      this.logger.error('Failed to log tax payment audit', {
        error: error.message,
        context: { gameId: context.gameId, playerId: context.playerId },
      });
    }
  }

  /**
   * Log property purchase audit trail.
   * 
   * Captures: player ID, property ID, cost, and balance after purchase.
   * 
   * @param context - Property purchase context
   */
  async logPropertyPurchase(context: PropertyPurchaseContext): Promise<void> {
    if (!this.isAuditEnabled()) {
      return;
    }

    const startTime = Date.now();

    try {
      // Redact sensitive data
      const redactedContext = this.redactor.redactObject(context);

      // Log to audit trail (async, with timeout)
      await Promise.race([
        this.auditTrailService.log(AuditAction.PLAYER_PROPERTY_BOUGHT, {
          userId: context.userId,
          changes: redactedContext,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        }),
        this.timeout(this.getAsyncTimeout()),
      ]);
    } catch (error) {
      this.logger.error('Failed to log property purchase audit', {
        error: error.message,
        context: { gameId: context.gameId, playerId: context.playerId },
      });
    }
  }
}
