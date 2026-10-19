import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  generateIdempotencyKey,
  purchasePayloadFingerprint,
  getIdempotencyKeyForPurchase,
  clearIdempotencyKeyForPurchase,
} from "./api";

const payload = { sku: "sku_gold_pack_100", quantity: 1 };

describe("idempotency key lifecycle", () => {
  beforeEach(() => {
    // Isolate the module-level cache between tests.
    clearIdempotencyKeyForPurchase(payload);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the same key for the same payload across calls (reuse on retry)", () => {
    const first = getIdempotencyKeyForPurchase(payload);
    const second = getIdempotencyKeyForPurchase(payload);

    expect(first).toBe(second);
    expect(typeof first).toBe("string");
    expect(first.length).toBeGreaterThan(0);
  });

  it("returns a different key when the quantity changes", () => {
    const before = getIdempotencyKeyForPurchase(payload);
    clearIdempotencyKeyForPurchase(payload);

    const after = getIdempotencyKeyForPurchase({ ...payload, quantity: 2 });
    expect(after).not.toBe(before);
  });

  it("returns a different key when the sku changes", () => {
    const before = getIdempotencyKeyForPurchase(payload);

    const after = getIdempotencyKeyForPurchase({ ...payload, sku: "sku_other" });
    expect(after).not.toBe(before);
  });

  it("generates a new key for the same payload after clearing the cache", () => {
    const before = getIdempotencyKeyForPurchase(payload);
    clearIdempotencyKeyForPurchase(payload);

    const after = getIdempotencyKeyForPurchase(payload);
    expect(after).not.toBe(before);
  });

  describe("generateIdempotencyKey", () => {
    it("returns a non-empty string and distinct values across calls", () => {
      const first = generateIdempotencyKey();
      const second = generateIdempotencyKey();

      expect(typeof first).toBe("string");
      expect(first.length).toBeGreaterThan(0);
      expect(first).not.toBe(second);
    });

    it("falls back to a 32-char hex string when randomUUID is unavailable", () => {
      const original = globalThis.crypto;
      try {
        vi.stubGlobal("crypto", {});
        const key = generateIdempotencyKey();

        expect(typeof key).toBe("string");
        expect(key.length).toBe(32);
        expect(/^[0-9a-f]{32}$/.test(key)).toBe(true);
      } finally {
        globalThis.crypto = original;
      }
    });
  });
});

describe("purchasePayloadFingerprint", () => {
  it("is stable for identical payloads", () => {
    expect(purchasePayloadFingerprint(payload)).toBe(
      purchasePayloadFingerprint(payload),
    );
  });

  it("differs when sku or quantity changes", () => {
    expect(purchasePayloadFingerprint(payload)).not.toBe(
      purchasePayloadFingerprint({ ...payload, quantity: 2 }),
    );
    expect(purchasePayloadFingerprint(payload)).not.toBe(
      purchasePayloadFingerprint({ ...payload, sku: "sku_other" }),
    );
  });
});
