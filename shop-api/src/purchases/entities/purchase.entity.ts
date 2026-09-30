import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Check,
} from "typeorm";

export enum PurchaseStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

/**
 * Purchase entity — shop-api is the SoT for purchases (ADR-001).
 *
 * Legacy columns (`itemId`, `amount` major units) are retained for
 * backwards compatibility with already-persisted rows and are populated
 * from the new canonical fields (`sku`, `quantity`, `amountMinor`, `currency`)
 * on write. New code MUST read `sku`/`quantity`/`amountMinor`; `itemId`/
 * `amount` are deprecated and will be removed after the catalog cutover
 * documented in docs/SHOP_ARCHITECTURE.md.
 *
 * Constraints enforce money bounds and inventory invariants at the DB level
 * so an application regression cannot silently produce a negative amount or
 * oversold quantity — the transaction fails instead.
 */
@Entity("purchases")
@Index(["userId"])
@Index(["sku"])
@Index(["createdAt"])
@Check('"quantity" >= 1 AND "quantity" <= 100')
@Check('"amountMinor" >= 0 AND "amountMinor" <= 10000000')
@Check('"amount" >= 0')
export class Purchase {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ length: 64 })
  userId: string;

  /**
   * Canonical SKU (new). Maps to catalog SKU; validated in DTO with
   * pattern + length bounds. Populated on every insert; `itemId` is kept
   * as an alias for legacy readers.
   */
  @Column({ length: 64 })
  sku: string;

  /**
   * Legacy item identifier. Retained for backwards compatibility; new writes
   * populate it from `sku` so legacy read models continue to work.
   * @deprecated Use `sku` instead.
   */
  @Column({ length: 64, nullable: true })
  itemId: string;

  /** Quantity validated to [1,100] in DTO and via DB CHECK. */
  @Column({ type: "int", default: 1 })
  quantity: number;

  /**
   * Amount in minor units (integer cents). Canonical money field.
   * Replaces `amount` float to avoid binary floating-point rounding.
   * Bounds: [0, 10_000_000] enforced in DTO and DB.
   */
  @Column({ type: "int", default: 0 })
  amountMinor: number;

  /**
   * Legacy decimal major units (`9.99`). Kept for already-stored rows and
   * for SHOP_ARCHITECTURE mapping (`final_price`); new writes set it to
   * `amountMinor / 100` formatted to 2 decimals so both columns stay in sync.
   * @deprecated Use `amountMinor`.
   */
  @Column("decimal", { precision: 10, scale: 2, default: 0 })
  amount: number;

  @Column({ type: "varchar", length: 10, default: "USD" })
  currency: string;

  @Column({ type: "varchar", default: PurchaseStatus.PENDING })
  status: PurchaseStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
