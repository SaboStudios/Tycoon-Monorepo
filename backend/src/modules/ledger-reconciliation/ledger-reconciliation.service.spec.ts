import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LedgerReconciliationService } from './ledger-reconciliation.service';
import { LedgerDiscrepancy, DiscrepancyStatus, DiscrepancyType } from './entities/ledger-discrepancy.entity';
import { Purchase } from '../shop/entities/purchase.entity';
import { ProviderOrder } from './interfaces/payment-provider.interface';

const start = new Date('2024-01-01T00:00:00Z');
const end = new Date('2024-01-02T00:00:00Z');

const makePurchase = (overrides: Partial<Purchase> = {}): Purchase =>
  ({
    id: 1,
    transaction_id: 'TXN-001',
    final_price: '9.99',
    currency: 'USD',
    status: 'completed',
    created_at: new Date('2024-01-01T12:00:00Z'),
    ...overrides,
  }) as Purchase;

const makeOrder = (overrides: Partial<ProviderOrder> = {}): ProviderOrder => ({
  transactionId: 'TXN-001',
  purchaseId: 1,
  amount: 9.99,
  currency: 'USD',
  status: 'completed',
  ...overrides,
});

describe('LedgerReconciliationService – dry-run vs apply (#1293)', () => {
  let service: LedgerReconciliationService;
  let discrepancyRepo: { create: jest.Mock; save: jest.Mock; find: jest.Mock; findOneOrFail: jest.Mock };
  let purchaseRepo: { find: jest.Mock };
  let providerClient: { fetchOrders: jest.Mock };

  beforeEach(async () => {
    discrepancyRepo = {
      create: jest.fn((data) => ({ ...data, id: Math.random() })),
      save: jest.fn((entities) => Promise.resolve(Array.isArray(entities) ? entities : entities)),
      find: jest.fn().mockResolvedValue([]),
      findOneOrFail: jest.fn(),
    };
    purchaseRepo = { find: jest.fn() };
    providerClient = { fetchOrders: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerReconciliationService,
        { provide: getRepositoryToken(Purchase), useValue: purchaseRepo },
        { provide: getRepositoryToken(LedgerDiscrepancy), useValue: discrepancyRepo },
        { provide: 'IPaymentProviderClient', useValue: providerClient },
      ],
    }).compile();

    service = module.get<LedgerReconciliationService>(LedgerReconciliationService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('dry-run mode', () => {
    it('returns a report without persisting anything', async () => {
      purchaseRepo.find.mockResolvedValue([makePurchase()]);
      providerClient.fetchOrders.mockResolvedValue([makeOrder({ amount: 19.99 })]);

      const report = await service.reconcile(start, end, true);

      expect(report.dryRun).toBe(true);
      expect(report.discrepancies).toHaveLength(1);
      expect(discrepancyRepo.save).not.toHaveBeenCalled();
    });

    it('reports amount mismatch in dry-run', async () => {
      purchaseRepo.find.mockResolvedValue([makePurchase({ final_price: '9.99' })]);
      providerClient.fetchOrders.mockResolvedValue([makeOrder({ amount: 19.99 })]);

      const report = await service.reconcile(start, end, true);

      expect(report.discrepancies[0].type).toBe(DiscrepancyType.AMOUNT_MISMATCH);
      expect(report.discrepancies[0].ledgerAmount).toBe('9.99');
      expect(report.discrepancies[0].providerAmount).toBe('19.99');
    });

    it('reports status mismatch in dry-run', async () => {
      purchaseRepo.find.mockResolvedValue([makePurchase({ status: 'completed' })]);
      providerClient.fetchOrders.mockResolvedValue([makeOrder({ status: 'refunded' })]);

      const report = await service.reconcile(start, end, true);

      expect(report.discrepancies[0].type).toBe(DiscrepancyType.STATUS_MISMATCH);
    });

    it('reports missing-in-provider in dry-run', async () => {
      purchaseRepo.find.mockResolvedValue([makePurchase({ transaction_id: 'TXN-ORPHAN' })]);
      providerClient.fetchOrders.mockResolvedValue([]);

      const report = await service.reconcile(start, end, true);

      expect(report.discrepancies[0].type).toBe(DiscrepancyType.MISSING_IN_PROVIDER);
    });

    it('reports missing-in-ledger in dry-run', async () => {
      purchaseRepo.find.mockResolvedValue([]);
      providerClient.fetchOrders.mockResolvedValue([makeOrder({ transactionId: 'TXN-GHOST' })]);

      const report = await service.reconcile(start, end, true);

      expect(report.discrepancies[0].type).toBe(DiscrepancyType.MISSING_IN_LEDGER);
    });
  });

  describe('apply mode', () => {
    it('persists discrepancies when not dry-run', async () => {
      purchaseRepo.find.mockResolvedValue([makePurchase({ final_price: '5.00' })]);
      providerClient.fetchOrders.mockResolvedValue([makeOrder({ amount: 10.00 })]);

      const report = await service.reconcile(start, end, false);

      expect(report.dryRun).toBe(false);
      expect(discrepancyRepo.save).toHaveBeenCalledTimes(1);
      const saved = discrepancyRepo.save.mock.calls[0][0];
      expect(Array.isArray(saved)).toBe(true);
      expect(saved[0].status).toBe(DiscrepancyStatus.OPEN);
    });

    it('does not call save when there are no discrepancies', async () => {
      purchaseRepo.find.mockResolvedValue([makePurchase()]);
      providerClient.fetchOrders.mockResolvedValue([makeOrder()]);

      await service.reconcile(start, end, false);

      expect(discrepancyRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('report fields', () => {
    it('report contains runId, counts, and date range', async () => {
      purchaseRepo.find.mockResolvedValue([makePurchase(), makePurchase({ id: 2, transaction_id: 'TXN-002' })]);
      providerClient.fetchOrders.mockResolvedValue([makeOrder(), makeOrder({ transactionId: 'TXN-002' })]);

      const report = await service.reconcile(start, end, true);

      expect(typeof report.runId).toBe('string');
      expect(report.ledgerCount).toBe(2);
      expect(report.providerCount).toBe(2);
      expect(report.rangeStart).toEqual(start);
      expect(report.rangeEnd).toEqual(end);
      expect(report.discrepancies).toHaveLength(0);
    });

    it('alertThresholdBreached is false when rate is below threshold', async () => {
      const purchases = Array.from({ length: 100 }, (_, i) =>
        makePurchase({ id: i + 1, transaction_id: `TXN-${i}` }),
      );
      purchaseRepo.find.mockResolvedValue(purchases);
      providerClient.fetchOrders.mockResolvedValue(
        purchases.map((p) => makeOrder({ transactionId: p.transaction_id! })),
      );

      const report = await service.reconcile(start, end, true);

      expect(report.alertThresholdBreached).toBe(false);
    });

    it('alertThresholdBreached is true when discrepancy rate exceeds threshold', async () => {
      const purchases = Array.from({ length: 10 }, (_, i) =>
        makePurchase({ id: i + 1, transaction_id: `TXN-${i}`, final_price: '5.00' }),
      );
      purchaseRepo.find.mockResolvedValue(purchases);
      providerClient.fetchOrders.mockResolvedValue(
        purchases.map((p) => makeOrder({ transactionId: p.transaction_id!, amount: 99.99 })),
      );

      const report = await service.reconcile(start, end, true);

      expect(report.alertThresholdBreached).toBe(true);
    });
  });

  describe('resolveDiscrepancy', () => {
    it('marks a discrepancy as resolved', async () => {
      const discrepancy = {
        id: 1,
        status: DiscrepancyStatus.OPEN,
        resolutionNote: null,
      };
      discrepancyRepo.findOneOrFail.mockResolvedValue(discrepancy);
      discrepancyRepo.save.mockResolvedValue({
        ...discrepancy,
        status: DiscrepancyStatus.RESOLVED,
        resolutionNote: 'confirmed valid',
      });

      const result = await service.resolveDiscrepancy(1, 'confirmed valid');

      expect(result.status).toBe(DiscrepancyStatus.RESOLVED);
      expect(result.resolutionNote).toBe('confirmed valid');
    });
  });
});
