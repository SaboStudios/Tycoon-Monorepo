import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Purchase, PurchaseStatus } from './entities/purchase.entity';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { IdempotencyService } from '../idempotency/idempotency.service';

const OPERATION = 'purchases';

@Injectable()
export class PurchasesService {
  private readonly logger = new Logger(PurchasesService.name);

  constructor(
    @InjectRepository(Purchase)
    private readonly purchaseRepo: Repository<Purchase>,
    private readonly idempotencyService: IdempotencyService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Creates a purchase, guaranteeing exactly-once processing per idempotency key.
   *
   * Flow:
   *  1. Claim the idempotency key (insert PROCESSING row).
   *     - If already COMPLETED → return cached response immediately.
   *     - If PROCESSING       → 409 Conflict (concurrent duplicate).
   *     - If FAILED           → delete stale record, allow retry.
   *  2. Open a DB transaction.
   *  3. Create the purchase record inside the transaction.
   *  4. On success: commit, then mark idempotency key COMPLETED with cached body.
   *  5. On failure: rollback, mark idempotency key FAILED so client may retry.
   */
  async create(
    dto: CreatePurchaseDto,
    idempotencyKey: string,
  ): Promise<Purchase> {
    // Step 1 — claim the key (throws on concurrent duplicate).
    const { isReplay, record } = await this.idempotencyService.claimKey(
      idempotencyKey,
      OPERATION,
    );

    if (isReplay) {
      const cached = this.idempotencyService.getCachedResponse(record);
      this.logger.log(`Returning cached purchase [userId=${dto.userId}]`);
      return cached.body as Purchase;
    }

    // Step 2-4 — do the real work inside a transaction.
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Step 3 — persist the purchase.
      const purchase = queryRunner.manager.create(Purchase, {
        userId: dto.userId,
        itemId: dto.itemId,
        amount: dto.amount,
        status: PurchaseStatus.COMPLETED,
      });
      const saved = await queryRunner.manager.save(Purchase, purchase);

      // Step 4 — commit business data.
      await queryRunner.commitTransaction();

      // Mark idempotency key completed *after* commit so the cached body
      // is only stored once the purchase is durably persisted.
      await this.idempotencyService.markCompleted(idempotencyKey, {
        status: 201,
        body: saved,
      });

      this.logger.log(
        `Purchase created [purchaseId=${saved.id}, userId=${dto.userId}]`,
      );
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();

      // Mark the key FAILED so the client can retry with the same key.
      await this.idempotencyService.markFailed(idempotencyKey);

      // Log without exposing sensitive fields.
      this.logger.error(
        `Purchase failed [userId=${dto.userId}, itemId=${dto.itemId}]: ${(err as Error).message}`,
      );
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /** Retrieves a single purchase by ID. */
  async findOne(id: string): Promise<Purchase | null> {
    return this.purchaseRepo.findOneBy({ id });
  }
}
