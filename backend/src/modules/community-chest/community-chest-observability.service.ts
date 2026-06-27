import { Injectable, Logger } from '@nestjs/common';
import { Counter, Histogram, register, Registry } from 'prom-client';

@Injectable()
export class CommunityChestObservabilityService {
  private readonly logger = new Logger(CommunityChestObservabilityService.name);

  private cardsDrawnTotal: Counter;
  private cardsCreatedTotal: Counter;
  private drawOperationDuration: Histogram;
  private createOperationDuration: Histogram;
  private listOperationDuration: Histogram;
  private payoutAmountTotal: Histogram;
  private errorsTotal: Counter;

  constructor() {
    // Initialize metrics with try-catch to handle already registered metrics in tests
    this.initializeMetrics();
  }

  private initializeMetrics() {
    try {
      const existing = register.getSingleMetric('tycoon_community_chest_draws_total');
      this.cardsDrawnTotal = existing as Counter;
    } catch {
      this.cardsDrawnTotal = new Counter({
        name: 'tycoon_community_chest_draws_total',
        help: 'Total Community Chest cards drawn',
        labelNames: ['card_type'],
      });
    }

    try {
      const existing = register.getSingleMetric('tycoon_community_chest_created_total');
      this.cardsCreatedTotal = existing as Counter;
    } catch {
      this.cardsCreatedTotal = new Counter({
        name: 'tycoon_community_chest_created_total',
        help: 'Total Community Chest cards created',
        labelNames: ['card_type'],
      });
    }

    try {
      const existing = register.getSingleMetric('tycoon_community_chest_draw_duration_seconds');
      this.drawOperationDuration = existing as Histogram;
    } catch {
      this.drawOperationDuration = new Histogram({
        name: 'tycoon_community_chest_draw_duration_seconds',
        help: 'Duration of draw operations in seconds',
        buckets: [0.01, 0.05, 0.1, 0.25, 0.5],
      });
    }

    try {
      const existing = register.getSingleMetric('tycoon_community_chest_create_duration_seconds');
      this.createOperationDuration = existing as Histogram;
    } catch {
      this.createOperationDuration = new Histogram({
        name: 'tycoon_community_chest_create_duration_seconds',
        help: 'Duration of create operations in seconds',
        labelNames: ['card_type'],
        buckets: [0.01, 0.05, 0.1, 0.25, 0.5],
      });
    }

    try {
      const existing = register.getSingleMetric('tycoon_community_chest_list_duration_seconds');
      this.listOperationDuration = existing as Histogram;
    } catch {
      this.listOperationDuration = new Histogram({
        name: 'tycoon_community_chest_list_duration_seconds',
        help: 'Duration of list operations in seconds',
        buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1],
      });
    }

    try {
      const existing = register.getSingleMetric('tycoon_community_chest_payout_amount');
      this.payoutAmountTotal = existing as Histogram;
    } catch {
      this.payoutAmountTotal = new Histogram({
        name: 'tycoon_community_chest_payout_amount',
        help: 'Distribution of Community Chest card payout amounts',
        labelNames: ['card_type'],
        buckets: [10, 50, 100, 250, 500, 1000],
      });
    }

    try {
      const existing = register.getSingleMetric('tycoon_community_chest_errors_total');
      this.errorsTotal = existing as Counter;
    } catch {
      this.errorsTotal = new Counter({
        name: 'tycoon_community_chest_errors_total',
        help: 'Total Community Chest operation errors',
        labelNames: ['operation', 'error_type'],
      });
    }
  }

  recordCardDraw(
    cardType: string | undefined,
    correlationId?: string,
    gameId?: number,
    playerId?: number,
  ): void {
    const type = cardType || 'unknown';
    this.cardsDrawnTotal.inc({ card_type: type });

    this.logger.log(
      'Community Chest card drawn',
      {
        context: 'CommunityChest',
        operation: 'draw',
        card_type: type,
        correlationId,
        gameId,
        playerId,
        timestamp: new Date().toISOString(),
      } as any,
    );
  }

  recordCardCreated(
    cardType: string,
    correlationId?: string,
    payout?: number,
  ): void {
    this.cardsCreatedTotal.inc({ card_type: cardType });

    if (payout !== undefined) {
      this.payoutAmountTotal.observe({ card_type: cardType }, payout);
    }

    this.logger.log(
      'Community Chest card created',
      {
        context: 'CommunityChest',
        operation: 'create',
        card_type: cardType,
        payout,
        correlationId,
        timestamp: new Date().toISOString(),
      } as any,
    );
  }

  recordListOperation(itemCount: number, correlationId?: string): void {
    this.logger.debug(
      `Community Chest list operation retrieved ${itemCount} items`,
      {
        context: 'CommunityChest',
        operation: 'list',
        item_count: itemCount,
        correlationId,
        timestamp: new Date().toISOString(),
      } as any,
    );
  }

  recordCardRetrieved(
    cardId: number,
    found: boolean,
    correlationId?: string,
  ): void {
    if (!found) {
      this.logger.warn(
        `Community Chest card ${cardId} not found`,
        {
          context: 'CommunityChest',
          operation: 'get',
          card_id: cardId,
          found: false,
          correlationId,
          timestamp: new Date().toISOString(),
        } as any,
      );
    }
  }

  recordError(
    operation: 'draw' | 'create' | 'list' | 'get',
    errorType: string,
    errorMessage?: string,
    correlationId?: string,
  ): void {
    this.errorsTotal.inc({ operation, error_type: errorType });

    this.logger.error(
      `Community Chest ${operation} error: ${errorType}`,
      {
        context: 'CommunityChest',
        operation,
        error_type: errorType,
        error_message: errorMessage,
        correlationId,
        timestamp: new Date().toISOString(),
      } as any,
    );
  }

  startTimer(
    operation: 'draw' | 'create' | 'list',
  ): { end: () => void; cardType?: string } {
    if (operation === 'draw') {
      return { end: this.drawOperationDuration.startTimer() };
    }
    if (operation === 'create') {
      const endTimer = this.createOperationDuration.startTimer();
      return { end: () => {}, cardType: undefined };
    }
    if (operation === 'list') {
      return { end: this.listOperationDuration.startTimer() };
    }
    return { end: () => {} };
  }

  async getMetrics(): Promise<string> {
    return register.metrics();
  }
}
