import { afterEach, describe, expect, it } from "vitest";
import { getNearContractId, getNearNetworkId } from "@/lib/near/config";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_NEAR_NETWORK;
  delete process.env.NEXT_PUBLIC_NEAR_CONTRACT_ID;
});

describe("getNearNetworkId", () => {
  it("defaults to testnet when env is unset", () => {
    expect(getNearNetworkId()).toBe("testnet");
  });

  it("returns mainnet when env is 'mainnet'", () => {
    process.env.NEXT_PUBLIC_NEAR_NETWORK = "mainnet";
    expect(getNearNetworkId()).toBe("mainnet");
  });

  it("is case-insensitive (MAINNET → mainnet)", () => {
    process.env.NEXT_PUBLIC_NEAR_NETWORK = "MAINNET";
    expect(getNearNetworkId()).toBe("mainnet");
  });

  it("falls back to testnet for unknown values", () => {
    process.env.NEXT_PUBLIC_NEAR_NETWORK = "staging";
    expect(getNearNetworkId()).toBe("testnet");
  });
});

describe("getNearContractId", () => {
  it("returns default testnet contract when env is unset", () => {
    expect(getNearContractId("testnet")).toBe("guest-book.testnet");
  });

  it("returns default mainnet contract when env is unset", () => {
    expect(getNearContractId("mainnet")).toBe("social.near");
  });

  it("prefers NEXT_PUBLIC_NEAR_CONTRACT_ID over default", () => {
    process.env.NEXT_PUBLIC_NEAR_CONTRACT_ID = "my-contract.testnet";
    expect(getNearContractId("testnet")).toBe("my-contract.testnet");
  });

  it("trims whitespace from env value", () => {
    process.env.NEXT_PUBLIC_NEAR_CONTRACT_ID = "  my-contract.testnet  ";
    expect(getNearContractId("testnet")).toBe("my-contract.testnet");
  });
});
