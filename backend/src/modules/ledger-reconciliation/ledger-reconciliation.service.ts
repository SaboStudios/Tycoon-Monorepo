import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { randomUUID } from 'crypto';
import { Purchase } from '../shop/entities/purchase.entity';
import {
  LedgerDiscrepancy,
  DiscrepancyType,
  DiscrepancyStatus,
} from './entities/ledger-discrepancy.entity';
import type { IPaymentProviderClient } from './interfaces/payment-provider.interface';

export interface ReconciliationReport {
  runId: string;
  dryRun: boolean;
  rangeStart: Date;
  rangeEnd: Date;
  ledgerCount: number;
  providerCount: number;
  discrepancies: DiscrepancySummary[];
  alertThresholdBreached: boolean;
}

export interface DiscrepancySummary {
  type: DiscrepancyType;
  purchaseId: number | null;
  transactionId: string | null;
  ledgerAmount: string | null;
  providerAmount: string | null;
  ledgerStatus: string | null;
  providerStatus: string | null;
}

/** Percentage of ledger records that may have discrepancies before alerting */
const ALERT_THRESHOLD_PERCENT = 5;

@Injectable()
export class LedgerReconciliationService {
  private readonly logger = new Logger(LedgerReconciliationService.name);

  constructor(
    @InjectRepository(Purchase)
    private readonly purchaseRepo: Repository<Purchase>,
    @InjectRepository(LedgerDiscrepancy)
    private readonly discrepancyRepo: Repository<LedgerDiscrepancy>,
    @Inject('IPaymentProviderClient')
    private readonly providerClient: IPaymentProviderClient,
  ) {}

  /**
   * Run a reconciliation for the given date range.
   * In dry-run mode the report is produced but nothing is persisted.
   */
  async reconcile(
    startDate: Date,
    endDate: Date,
    dryRun = false,
  ): Promise<ReconciliationReport> {
    const runId = randomUUID();
    this.logger.log(
      `[${runId}] Starting reconciliation dryRun=${dryRun} ` +
        `range=${startDate.toISOString()} → ${endDate.toISOString()}`,
    );

    // 1. Fetch ledger records (read-only SELECT)
    const ledgerPurchases = await this.purchaseRepo.find({
      where: { created_at: Between(startDate, endDate) },
      select: [
        'id',
        'transaction_id',
        'final_price',
        'currency',
        'status',
      ] as (keyof Purchase)[],
    });

    // 2. Fetch provider records
    const providerOrders = await this.providerClient.fetchOrders(
      startDate,
      endDate,
    );

    // Build lookup maps
    const providerByTxId = new Map(
      providerOrders
        .filter((o) => o.transactionId)
        .map((o) => [o.transactionId, o]),
    );
    const ledgerByTxId = new Map(
      ledgerPurchases
        .filter((p) => p.transaction_id)
        .map((p) => [p.transaction_id, p]),
    );

    const discrepancies: DiscrepancySummary[] = [];

    // 3a. Check every ledger record against provider
    for (const purchase of ledgerPurchases) {
      if (!purchase.transaction_id) continue;

      const providerOrder = providerByTxId.get(purchase.transaction_id);

      if (!providerOrder) {
        discrepancies.push({
          type: DiscrepancyType.MISSING_IN_PROVIDER,
          purchaseId: purchase.id,
          transactionId: purchase.transaction_id,
          ledgerAmount: purchase.final_price,
          providerAmount: null,
          ledgerStatus: purchase.status,
          providerStatus: null,
        });
        continue;
      }

      const ledgerAmt = parseFloat(purchase.final_price);
      const providerAmt = providerOrder.amount;

      if (Math.abs(ledgerAmt - providerAmt) > 0.01) {
        discrepancies.push({
          type: DiscrepancyType.AMOUNT_MISMATCH,
          purchaseId: purchase.id,
          transactionId: purchase.transaction_id,
          ledgerAmount: purchase.final_price,
          providerAmount: String(providerAmt),
          ledgerStatus: purchase.status,
          providerStatus: providerOrder.status,
        });
      } else if (purchase.status !== providerOrder.status) {
        discrepancies.push({
          type: DiscrepancyType.STATUS_MISMATCH,
          purchaseId: purchase.id,
          transactionId: purchase.transaction_id,
          ledgerAmount: purchase.final_price,
          providerAmount: String(providerAmt),
          ledgerStatus: purchase.status,
          providerStatus: providerOrder.status,
        });
      }
    }

    // 3b. Provider orders not in ledger
    for (const order of providerOrders) {
      if (!order.transactionId) continue;
      if (!ledgerByTxId.has(order.transactionId)) {
        discrepancies.push({
          type: DiscrepancyType.MISSING_IN_LEDGER,
          purchaseId: order.purchaseId ?? null,
          transactionId: order.transactionId,
          ledgerAmount: null,
          providerAmount: String(order.amount),
          ledgerStatus: null,
          providerStatus: order.status,
        });
      }
    }

    const alertThresholdBreached =
      ledgerPurchases.length > 0 &&
      (discrepancies.length / ledgerPurchases.length) * 100 >
        ALERT_THRESHOLD_PERCENT;

    if (alertThresholdBreached) {
      this.logger.warn(
        `[${runId}] ALERT: discrepancy rate ${((discrepancies.length / ledgerPurchases.length) * 100).toFixed(1)}% ` +
          `exceeds threshold of ${ALERT_THRESHOLD_PERCENT}%`,
      );
    }

    // 4. Persist only when not dry-run
    if (!dryRun && discrepancies.length > 0) {
      const entities = discrepancies.map((d) =>
        this.discrepancyRepo.create({
          runId,
          purchaseId: d.purchaseId,
          transactionId: d.transactionId,
          type: d.type,
          ledgerAmount: d.ledgerAmount,
          providerAmount: d.providerAmount,
          ledgerStatus: d.ledgerStatus,
          providerStatus: d.providerStatus,
          status: DiscrepancyStatus.OPEN,
          metadata: { dryRun: false },
        }),
      );
      await this.discrepancyRepo.save(entities);
    }

    this.logger.log(
      `[${runId}] Reconciliation complete. ` +
        `ledger=${ledgerPurchases.length} provider=${providerOrders.length} ` +
        `discrepancies=${discrepancies.length} dryRun=${dryRun}`,
    );

    return {
      runId,
      dryRun,
      rangeStart: startDate,
      rangeEnd: endDate,
      ledgerCount: ledgerPurchases.length,
      providerCount: providerOrders.length,
      discrepancies,
      alertThresholdBreached,
    };
  }

  /** Resolve a discrepancy with a note (admin action, no data mutation). */
  async resolveDiscrepancy(id: number, note: string): Promise<LedgerDiscrepancy> {
    const discrepancy = await this.discrepancyRepo.findOneOrFail({ where: { id } });
    discrepancy.status = DiscrepancyStatus.RESOLVED;
    discrepancy.resolutionNote = note;
    return this.discrepancyRepo.save(discrepancy);
  }

  async findDiscrepancies(runId?: string): Promise<LedgerDiscrepancy[]> {
    return this.discrepancyRepo.find({
      where: runId ? { runId } : {},
      order: { createdAt: 'DESC' },
      take: 500,
    });
  }
}
