import { Injectable, Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';

export interface InventoryReservation {
  id: string;
  sku: string;
  quantity: number;
  userId: string;
  idempotencyKey: string;
  expiresAt: Date;
  status: 'pending' | 'confirmed' | 'released';
}

export interface PurchaseRequest {
  sku: string;
  quantity: number;
  userId: string;
  idempotencyKey: string;
  price: number;
  currency: string;
}

@Injectable()
export class InventoryAntiOversellService {
  private readonly logger = new Logger(InventoryAntiOversellService.name);

  constructor(private readonly dataSource: DataSource) {}

  async reserveInventory(request: PurchaseRequest): Promise<InventoryReservation> {
    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existing = await this.checkIdempotency(queryRunner, request.idempotencyKey);
      if (existing) {
        this.logger.warn('Duplicate idempotency key', { key: request.idempotencyKey });
        return existing;
      }

      const inventory = await queryRunner.query(
        `SELECT quantity FROM inventory WHERE sku = $1 FOR UPDATE`,
        [request.sku],
      );

      if (!inventory || inventory.length === 0) {
        throw new Error('SKU_NOT_FOUND');
      }

      const currentQuantity = inventory[0].quantity;
      if (currentQuantity < request.quantity) {
        throw new Error('INSUFFICIENT_INVENTORY');
      }

      await queryRunner.query(
        `UPDATE inventory SET quantity = quantity - $1, updated_at = NOW() WHERE sku = $2`,
        [request.quantity, request.sku],
      );

      const reservation: InventoryReservation = {
        id: crypto.randomUUID(),
        sku: request.sku,
        quantity: request.quantity,
        userId: request.userId,
        idempotencyKey: request.idempotencyKey,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        status: 'confirmed',
      };

      await queryRunner.query(
        `INSERT INTO inventory_reservations (id, sku, quantity, user_id, idempotency_key, expires_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [reservation.id, reservation.sku, reservation.quantity, reservation.userId,
         reservation.idempotencyKey, reservation.expiresAt, reservation.status],
      );

      await queryRunner.query(
        `INSERT INTO idempotency_keys (key, response, created_at)
         VALUES ($1, $2, NOW())`,
        [request.idempotencyKey, JSON.stringify(reservation)],
      );

      await queryRunner.commitTransaction();

      this.logger.info('Inventory reserved', {
        sku: request.sku,
        quantity: request.quantity,
        userId: request.userId,
      });

      return reservation;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async checkIdempotency(queryRunner: QueryRunner, key: string): Promise<InventoryReservation | null> {
    const result = await queryRunner.query(
      `SELECT response FROM idempotency_keys WHERE key = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
      [key],
    );
    if (result && result.length > 0) {
      return JSON.parse(result[0].response);
    }
    return null;
  }

  async releaseExpiredReservations(): Promise<number> {
    const result = await this.dataSource.query(
      `UPDATE inventory SET quantity = quantity + ir.quantity
       FROM inventory_reservations ir
       WHERE ir.sku = inventory.sku AND ir.expires_at < NOW() AND ir.status = 'confirmed'
       RETURNING ir.id`,
    );
    return result.length;
  }
}
