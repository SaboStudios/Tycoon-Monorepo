import { describe, expect, it } from "vitest";
import {
  isDepositSafe,
  sanitizeErrorMessage,
  MAX_DEPOSIT_YOCTO,
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
