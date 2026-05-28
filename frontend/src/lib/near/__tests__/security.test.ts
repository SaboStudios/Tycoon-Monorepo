import { describe, it, expect } from "vitest";
import { isDepositSafe, sanitizeErrorMessage, MAX_DEPOSIT_YOCTO } from "../security";

describe("isDepositSafe", () => {
  it("returns true for zero deposit", () => {
    expect(isDepositSafe(BigInt(0))).toBe(true);
  });

  it("returns true for 1 yoctoNEAR", () => {
    expect(isDepositSafe(BigInt(1))).toBe(true);
  });

  it("returns true for exactly MAX_DEPOSIT_YOCTO (1 NEAR)", () => {
    expect(isDepositSafe(MAX_DEPOSIT_YOCTO)).toBe(true);
  });

  it("returns false for MAX_DEPOSIT_YOCTO + 1", () => {
    expect(isDepositSafe(MAX_DEPOSIT_YOCTO + BigInt(1))).toBe(false);
  });

  it("returns false for a very large deposit", () => {
    expect(isDepositSafe(BigInt("999999999999999999999999999"))).toBe(false);
  });

  it("returns false for a negative deposit", () => {
    expect(isDepositSafe(BigInt(-1))).toBe(false);
  });
});

describe("sanitizeErrorMessage", () => {
  it("passes through a normal error message unchanged", () => {
    expect(sanitizeErrorMessage("Network timeout")).toBe("Network timeout");
  });

  it("redacts a seed phrase pattern", () => {
    const msg =
      "abandon ability able about above absent absorb abstract absurd abuse access accident";
    const result = sanitizeErrorMessage(msg);
    expect(result).toContain("[redacted]");
    expect(result).not.toContain("abandon");
  });

  it("redacts a base58 private key pattern (64+ chars)", () => {
    const fakeKey = "1".repeat(64); // 64 chars of base58-valid chars
    const result = sanitizeErrorMessage(`key: ${fakeKey}`);
    expect(result).toContain("[redacted]");
    expect(result).not.toContain(fakeKey);
  });

  it("truncates messages longer than maxLen", () => {
    // Use spaces to avoid triggering the private-key regex (base58 has no spaces).
    const long = "error: " + "a b ".repeat(75); // > 200 chars, no 64-char base58 run
    const result = sanitizeErrorMessage(long, 200);
    expect(result.length).toBeLessThanOrEqual(202); // 200 + "…"
    expect(result.endsWith("…")).toBe(true);
  });

  it("does not truncate messages within maxLen", () => {
    const short = "short error";
    expect(sanitizeErrorMessage(short)).toBe("short error");
  });

  it("uses default maxLen of 200 without truncating a 200-char safe string", () => {
    // Use spaces so the private-key regex cannot match (it requires 64+ consecutive base58 chars).
    const exactly200 = ("ab cd ").repeat(33).slice(0, 200); // 200 chars with spaces
    expect(sanitizeErrorMessage(exactly200)).toBe(exactly200);
  });
});
