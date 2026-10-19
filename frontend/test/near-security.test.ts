import { describe, expect, it } from "vitest";
import {
  isDepositSafe,
  sanitizeErrorMessage,
  MAX_DEPOSIT_YOCTO,
  isLikelyMainnetId,
  isLikelyTestnetId,
  assertContractIdForNetwork,
} from "@/lib/near/security";

describe("isDepositSafe", () => {
  it("allows zero deposit", () => {
    expect(isDepositSafe(BigInt(0))).toBe(true);
  });

  it("allows exactly 1 NEAR (MAX_DEPOSIT_YOCTO)", () => {
    expect(isDepositSafe(MAX_DEPOSIT_YOCTO)).toBe(true);
  });

  it("rejects one yoctoNEAR above the limit", () => {
    expect(isDepositSafe(MAX_DEPOSIT_YOCTO + BigInt(1))).toBe(false);
  });

  it("rejects a very large deposit (e.g. 100 NEAR)", () => {
    expect(isDepositSafe(MAX_DEPOSIT_YOCTO * BigInt(100))).toBe(false);
  });

  it("rejects negative deposit", () => {
    expect(isDepositSafe(BigInt(-1))).toBe(false);
  });
});

describe("sanitizeErrorMessage", () => {
  it("passes through a normal short error unchanged", () => {
    expect(sanitizeErrorMessage("Insufficient gas")).toBe("Insufficient gas");
  });

  it("truncates messages longer than maxLen", () => {
    // Use spaces to avoid triggering the base58 key regex
    const long = ("error: " + "x ".repeat(150)).trim();
    const result = sanitizeErrorMessage(long);
    expect(result.length).toBeLessThanOrEqual(201); // 200 chars + ellipsis char
    expect(result.endsWith("…")).toBe(true);
  });

  it("respects a custom maxLen", () => {
    const result = sanitizeErrorMessage("hello world", 5);
    expect(result).toBe("hello…");
  });

  it("redacts a 12-word BIP-39-style seed phrase", () => {
    const seed =
      "abandon ability able about above absent absorb abstract absurd abuse access accident";
    const result = sanitizeErrorMessage(`Error: ${seed}`);
    expect(result).not.toContain("abandon ability");
    expect(result).toContain("[redacted]");
  });

  it("redacts a base58 private key pattern (64+ chars)", () => {
    // 88-char valid base58 string (all chars in [1-9A-HJ-NP-Za-km-z])
    const fakeKey = "5KQNtRxMnHMNZnHMNZnHMNZnHMNZnHMNZnHMNZnHMNZnHMNZnHMNZnHMNZnHMNZnHMNZnHMNZnHMNZnHMNZnH";
    const result = sanitizeErrorMessage(`key=${fakeKey}`);
    expect(result).not.toContain(fakeKey);
    expect(result).toContain("[redacted]");
  });

  it("does not redact a normal short alphanumeric token", () => {
    const result = sanitizeErrorMessage("tx hash: ABC123XYZ");
    expect(result).toBe("tx hash: ABC123XYZ");
  });
});

describe("isLikelyMainnetId", () => {
  it("returns true for a .near top-level account", () => {
    expect(isLikelyMainnetId("social.near")).toBe(true);
    expect(isLikelyMainnetId("myapp.near")).toBe(true);
  });

  it("returns false for a .testnet account", () => {
    expect(isLikelyMainnetId("myapp.testnet")).toBe(false);
    expect(isLikelyMainnetId("guest-book.testnet")).toBe(false);
  });

  it("returns false for an implicit 64-hex account", () => {
    // 64-char lowercase hex — valid on both networks
    const implicit = "a".repeat(64);
    expect(isLikelyMainnetId(implicit)).toBe(false);
  });

  it("is case-insensitive for the suffix", () => {
    expect(isLikelyMainnetId("myapp.NEAR")).toBe(true);
  });
});

describe("isLikelyTestnetId", () => {
  it("returns true for a .testnet account", () => {
    expect(isLikelyTestnetId("guest-book.testnet")).toBe(true);
  });

  it("returns false for a .near account", () => {
    expect(isLikelyTestnetId("social.near")).toBe(false);
  });

  it("returns false for an implicit account", () => {
    expect(isLikelyTestnetId("a".repeat(64))).toBe(false);
  });
});

describe("assertContractIdForNetwork", () => {
  it("throws when a mainnet ID is used on testnet", () => {
    expect(() => assertContractIdForNetwork("social.near", "testnet")).toThrow(
      /mainnet/,
    );
  });

  it("throw message includes the contract ID (dev-friendly)", () => {
    expect(() => assertContractIdForNetwork("myapp.near", "testnet")).toThrow(
      "myapp.near",
    );
  });

  it("throw message mentions NEXT_PUBLIC_NEAR_NETWORK", () => {
    expect(() => assertContractIdForNetwork("myapp.near", "testnet")).toThrow(
      "NEXT_PUBLIC_NEAR_NETWORK",
    );
  });

  it("does NOT throw when a testnet ID is used on testnet", () => {
    expect(() =>
      assertContractIdForNetwork("guest-book.testnet", "testnet"),
    ).not.toThrow();
  });

  it("does NOT throw when a mainnet ID is used on mainnet", () => {
    expect(() =>
      assertContractIdForNetwork("social.near", "mainnet"),
    ).not.toThrow();
  });

  it("does NOT throw for an implicit account on testnet", () => {
    // 64-char hex — not a named account, safe to pass through
    expect(() =>
      assertContractIdForNetwork("a".repeat(64), "testnet"),
    ).not.toThrow();
  });

  it("does NOT throw for an implicit account on mainnet", () => {
    expect(() =>
      assertContractIdForNetwork("a".repeat(64), "mainnet"),
    ).not.toThrow();
  });
});
