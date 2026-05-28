import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getNearNetworkId,
  isValidNearAccountId,
  getNearContractId,
  DEFAULT_FUNCTION_CALL_GAS,
} from "../config";

describe("getNearNetworkId", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns testnet by default when env is unset", () => {
    delete process.env.NEXT_PUBLIC_NEAR_NETWORK;
    expect(getNearNetworkId()).toBe("testnet");
  });

  it("returns mainnet when env is 'mainnet'", () => {
    process.env.NEXT_PUBLIC_NEAR_NETWORK = "mainnet";
    expect(getNearNetworkId()).toBe("mainnet");
  });

  it("returns mainnet when env is 'MAINNET' (case-insensitive)", () => {
    process.env.NEXT_PUBLIC_NEAR_NETWORK = "MAINNET";
    expect(getNearNetworkId()).toBe("mainnet");
  });

  it("returns testnet for any other value", () => {
    process.env.NEXT_PUBLIC_NEAR_NETWORK = "staging";
    expect(getNearNetworkId()).toBe("testnet");
  });
});

describe("isValidNearAccountId", () => {
  it("accepts a simple account id", () => {
    expect(isValidNearAccountId("alice.near")).toBe(true);
  });

  it("accepts a testnet account id", () => {
    expect(isValidNearAccountId("guest-book.testnet")).toBe(true);
  });

  it("accepts minimum length (2 chars)", () => {
    expect(isValidNearAccountId("ab")).toBe(true);
  });

  it("accepts maximum length (64 chars)", () => {
    expect(isValidNearAccountId("a".repeat(64))).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isValidNearAccountId("")).toBe(false);
  });

  it("rejects single character", () => {
    expect(isValidNearAccountId("a")).toBe(false);
  });

  it("rejects 65+ characters", () => {
    expect(isValidNearAccountId("a".repeat(65))).toBe(false);
  });

  it("rejects uppercase letters", () => {
    expect(isValidNearAccountId("Alice.near")).toBe(false);
  });

  it("rejects spaces", () => {
    expect(isValidNearAccountId("alice near")).toBe(false);
  });

  it("rejects injection-like strings", () => {
    expect(isValidNearAccountId("alice; DROP TABLE")).toBe(false);
  });

  it("accepts underscores, hyphens, and dots", () => {
    expect(isValidNearAccountId("my_account-1.testnet")).toBe(true);
  });
});

describe("getNearContractId", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns the default testnet contract when env is unset", () => {
    delete process.env.NEXT_PUBLIC_NEAR_CONTRACT_ID;
    expect(getNearContractId("testnet")).toBe("guest-book.testnet");
  });

  it("returns the default mainnet contract when env is unset", () => {
    delete process.env.NEXT_PUBLIC_NEAR_CONTRACT_ID;
    expect(getNearContractId("mainnet")).toBe("social.near");
  });

  it("returns the env contract id when valid", () => {
    process.env.NEXT_PUBLIC_NEAR_CONTRACT_ID = "my-contract.testnet";
    expect(getNearContractId("testnet")).toBe("my-contract.testnet");
  });

  it("falls back to default when env contract id is invalid", () => {
    process.env.NEXT_PUBLIC_NEAR_CONTRACT_ID = "INVALID CONTRACT!";
    expect(getNearContractId("testnet")).toBe("guest-book.testnet");
  });

  it("trims whitespace from env value", () => {
    process.env.NEXT_PUBLIC_NEAR_CONTRACT_ID = "  my-contract.testnet  ";
    // trimmed value is valid
    expect(getNearContractId("testnet")).toBe("my-contract.testnet");
  });

  it("uses getNearNetworkId() as default networkId argument", () => {
    delete process.env.NEXT_PUBLIC_NEAR_CONTRACT_ID;
    delete process.env.NEXT_PUBLIC_NEAR_NETWORK;
    // default network is testnet
    expect(getNearContractId()).toBe("guest-book.testnet");
  });
});

describe("DEFAULT_FUNCTION_CALL_GAS", () => {
  it("is 30 Tgas expressed as a BigInt", () => {
    expect(DEFAULT_FUNCTION_CALL_GAS).toBe(BigInt("30000000000000"));
  });
});
