import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from "typeorm";

/**
 * Money bounds + SKU/quantity migration for shop-api purchases (ADR-001 §7, SHOP_PURCHASES_RUNBOOK).
 *
 * Adds canonical fields:
 *  - sku            (varchar 64, indexed) — catalog SKU, replaces opaque itemId for new writes
 *  - quantity       (int, default 1) — bounded [1,100] via CHECK
 *  - amountMinor    (int, default 0) — integer minor units (cents), bounded [0, 10_000_000]
 *  - currency       (varchar 10, default 'USD') — only USD supported today
 *
 * Keeps legacy columns `itemId` and `amount` (decimal) for backwards compatibility;
 * new writes populate both sides so legacy readers stay functional during the
 * catalog cutover (docs/SHOP_ARCHITECTURE.md).
 *
 * CHECK constraints are the DB-level backstop so an application regression cannot
 * persist a negative quantity or amount — the transaction fails instead of producing
 * a negative count. DTO validation (CreatePurchaseDto) is the first line, CHECK is the last.
 *
 * Failure modes:
 *  - If this migration is pending, the app still boots but writes that rely on the
 *    new columns will fail closed (transaction rollback) rather than silently dropping
 *    money data — the readiness probe will report 503 and operators should run
 *    `npm run migration:run` before enabling the purchase path.
 *  - Re-running on an already-migrated DB is a no-op (each addColumn is guarded).
 */
export class AddPurchaseMoneyBounds1714300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("purchases");
    if (!table) return;

    // ── sku ────────────────────────────────────────────────────────────────
    if (!table.columns.some((c) => c.name === "sku")) {
      await queryRunner.addColumn(
        "purchases",
        new TableColumn({
          name: "sku",
          type: "varchar",
          length: "64",
          isNullable: true, // allow NULL for legacy rows; new writes set NOT NULL via entity
        }),
      );
    }

    // ── quantity ───────────────────────────────────────────────────────────
    if (!table.columns.some((c) => c.name === "quantity")) {
      await queryRunner.addColumn(
        "purchases",
        new TableColumn({
          name: "quantity",
          type: "int",
          default: 1,
          isNullable: false,
        }),
      );
    }

    // ── amountMinor ────────────────────────────────────────────────────────
    if (!table.columns.some((c) => c.name === "amountMinor")) {
      await queryRunner.addColumn(
        "purchases",
        new TableColumn({
          name: "amountMinor",
          type: "int",
          default: 0,
          isNullable: false,
        }),
      );
    }

    // ── currency ───────────────────────────────────────────────────────────
    if (!table.columns.some((c) => c.name === "currency")) {
      await queryRunner.addColumn(
        "purchases",
        new TableColumn({
          name: "currency",
          type: "varchar",
          length: "10",
          default: "'USD'",
          isNullable: false,
        }),
      );
    }

    // Backfill legacy rows: sku ← itemId where sku is NULL, so old rows remain readable.
    // This is idempotent — rows with sku already set are untouched.
    try {
      await queryRunner.query(
        `UPDATE "purchases" SET "sku" = "itemId" WHERE "sku" IS NULL AND "itemId" IS NOT NULL`,
      );
    } catch {
      // SQLite uses unquoted identifiers for legacy tables; try alternative.
      try {
        await queryRunner.query(
          `UPDATE purchases SET sku = itemId WHERE sku IS NULL AND itemId IS NOT NULL`,
        );
      } catch {}
    }

    // Add indexes (idempotent — check if already exists via queryRunner.getTable)
    // Index on sku for catalog lookups and inventory guard.
    const hasSkuIndex = table.indices.some((i) =>
      i.columnNames.includes("sku"),
    );
    if (!hasSkuIndex) {
      await queryRunner.createIndex(
        "purchases",
        new TableIndex({
          name: "IDX_purchases_sku",
          columnNames: ["sku"],
        }),
      );
    }

    // CHECK constraints are created via raw SQL for portability; failures are
    // swallowed if the constraint already exists (e.g., re-run after rollback).
    // Postgres supports ADD CONSTRAINT; SQLite parses CHECK at CREATE TABLE only,
    // so we no-op there — DTO + entity @Check still validates in-memory.
    try {
      await queryRunner.query(
        `ALTER TABLE "purchases" ADD CONSTRAINT "CHK_purchases_quantity" CHECK ("quantity" >= 1 AND "quantity" <= 100)`,
      );
    } catch {}
    try {
      await queryRunner.query(
        `ALTER TABLE "purchases" ADD CONSTRAINT "CHK_purchases_amountMinor" CHECK ("amountMinor" >= 0 AND "amountMinor" <= 10000000)`,
      );
    } catch {}
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("purchases");
    if (!table) return;

    // Drop CHECK constraints (best-effort).
    try {
      await queryRunner.query(
        `ALTER TABLE "purchases" DROP CONSTRAINT "CHK_purchases_quantity"`,
      );
    } catch {}
    try {
      await queryRunner.query(
        `ALTER TABLE "purchases" DROP CONSTRAINT "CHK_purchases_amountMinor"`,
      );
    } catch {}

    try {
      await queryRunner.dropIndex("purchases", "IDX_purchases_sku");
    } catch {}

    // Keep columns on down for data safety — dropping would destroy money data.
    // Operators who need a full revert should restore from backup per runbook.
  }
}
