import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreatePurchaseDto } from "./create-purchase.dto";

async function validateDto(payload: Record<string, unknown>) {
  const instance = plainToInstance(CreatePurchaseDto, payload);
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors;
}

describe("CreatePurchaseDto — money bounds validation (ADR-001 §7, SHOP_PURCHASES_RUNBOOK)", () => {
  const baseValid = {
    userId: "usr_8821",
    sku: "sku_gold_pack_100",
    quantity: 1,
    amountMinor: 4999,
    currency: "USD",
  };

  it("accepts a minimal valid payload (sku, quantity 1, amountMinor 0)", async () => {
    const errors = await validateDto(baseValid);
    expect(errors).toHaveLength(0);
  });

  it("accepts quantity at upper bound 100 and amountMinor at 10_000_000", async () => {
    const errors = await validateDto({
      ...baseValid,
      quantity: 100,
      amountMinor: 10_000_000,
    });
    expect(errors).toHaveLength(0);
  });

  it("rejects empty sku", async () => {
    const errors = await validateDto({ ...baseValid, sku: "" });
    expect(errors.some((e) => e.property === "sku")).toBe(true);
  });

  it("rejects sku longer than 64", async () => {
    const errors = await validateDto({ ...baseValid, sku: "x".repeat(65) });
    expect(errors.some((e) => e.property === "sku")).toBe(true);
  });

  it("rejects sku with invalid characters (injection)", async () => {
    const errors = await validateDto({ ...baseValid, sku: "sku; DROP--" });
    expect(errors.some((e) => e.property === "sku")).toBe(true);
  });

  it("trims sku and userId", async () => {
    const instance = plainToInstance(CreatePurchaseDto, {
      ...baseValid,
      sku: "  sku_gold_pack_100  ",
      userId: "  usr_8821  ",
    });
    // Transform should trim
    expect(instance.sku).toBe("sku_gold_pack_100");
    expect(instance.userId).toBe("usr_8821");
  });

  it("rejects quantity 0", async () => {
    const errors = await validateDto({ ...baseValid, quantity: 0 });
    expect(errors.some((e) => e.property === "quantity")).toBe(true);
  });

  it("rejects quantity negative", async () => {
    const errors = await validateDto({ ...baseValid, quantity: -1 });
    expect(errors.some((e) => e.property === "quantity")).toBe(true);
  });

  it("rejects quantity >100", async () => {
    const errors = await validateDto({ ...baseValid, quantity: 101 });
    expect(errors.some((e) => e.property === "quantity")).toBe(true);
  });

  it("rejects quantity float", async () => {
    const errors = await validateDto({ ...baseValid, quantity: 1.5 });
    expect(errors.some((e) => e.property === "quantity")).toBe(true);
  });

  it("rejects quantity NaN / string that does not coerce", async () => {
    const errors = await validateDto({
      ...baseValid,
      quantity: "not-a-number" as any,
    });
    expect(errors.some((e) => e.property === "quantity")).toBe(true);
  });

  it("rejects amountMinor negative", async () => {
    const errors = await validateDto({ ...baseValid, amountMinor: -1 });
    expect(errors.some((e) => e.property === "amountMinor")).toBe(true);
  });

  it("rejects amountMinor >10_000_000", async () => {
    const errors = await validateDto({ ...baseValid, amountMinor: 10_000_001 });
    expect(errors.some((e) => e.property === "amountMinor")).toBe(true);
  });

  it("rejects amountMinor float (must be integer minor units)", async () => {
    const errors = await validateDto({ ...baseValid, amountMinor: 49.99 });
    expect(errors.some((e) => e.property === "amountMinor")).toBe(true);
  });

  it("rejects amountMinor string float", async () => {
    const errors = await validateDto({
      ...baseValid,
      amountMinor: "4999.5" as any,
    });
    // Type transform will coerce string "4999.5" to number 4999.5 then IsInt fails
    expect(errors.some((e) => e.property === "amountMinor")).toBe(true);
  });

  it("rejects amountMinor Infinity", async () => {
    const errors = await validateDto({
      ...baseValid,
      amountMinor: Infinity as any,
    });
    expect(errors.some((e) => e.property === "amountMinor")).toBe(true);
  });

  it("rejects unknown field price (no client-trusted price)", async () => {
    const errors = await validateDto({ ...baseValid, price: 999 } as any);
    expect(errors.some((e) => e.property === "price")).toBe(true);
  });

  it("rejects legacy amount float field", async () => {
    const errors = await validateDto({
      userId: "u1",
      sku: "sku1",
      quantity: 1,
      amount: 49.99,
    } as any);
    expect(errors.some((e) => e.property === "amount")).toBe(true);
  });

  it("rejects legacy itemId field", async () => {
    const errors = await validateDto({
      userId: "u1",
      itemId: "item-1",
      sku: "sku1",
      quantity: 1,
      amountMinor: 100,
    } as any);
    expect(errors.some((e) => e.property === "itemId")).toBe(true);
  });

  it("rejects oversized payload via MaxLength (sku 65+)", async () => {
    const longSku = "a".repeat(65);
    const errors = await validateDto({ ...baseValid, sku: longSku });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects currency other than USD", async () => {
    const errors = await validateDto({ ...baseValid, currency: "EUR" });
    expect(errors.some((e) => e.property === "currency")).toBe(true);
  });

  it("accepts missing currency (defaults to USD server-side)", async () => {
    const { currency, ...withoutCurrency } = baseValid;
    const errors = await validateDto(withoutCurrency as any);
    expect(errors).toHaveLength(0);
  });

  it("normalizes currency to uppercase and trims", async () => {
    const instance = plainToInstance(CreatePurchaseDto, {
      ...baseValid,
      currency: "  usd  ",
    });
    expect(instance.currency).toBe("USD");
  });

  it("rejects empty userId", async () => {
    const errors = await validateDto({ ...baseValid, userId: "" });
    expect(errors.some((e) => e.property === "userId")).toBe(true);
  });

  it("rejects userId longer than 64", async () => {
    const errors = await validateDto({ ...baseValid, userId: "x".repeat(65) });
    expect(errors.some((e) => e.property === "userId")).toBe(true);
  });

  it("coerces string quantity/amountMinor via @Type(()=>Number)", async () => {
    const errors = await validateDto({
      ...baseValid,
      quantity: "2" as any,
      amountMinor: "2500" as any,
    });
    expect(errors).toHaveLength(0);
    const instance = plainToInstance(CreatePurchaseDto, {
      ...baseValid,
      quantity: "2" as any,
      amountMinor: "2500" as any,
    });
    expect(typeof instance.quantity).toBe("number");
    expect(instance.quantity).toBe(2);
    expect(instance.amountMinor).toBe(2500);
  });
});
