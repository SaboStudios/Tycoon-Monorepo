import { describe, it, expect } from "vitest";
import { getExplorerTransactionUrl } from "../explorer";

describe("getExplorerTransactionUrl", () => {
  it("returns a testnet explorer URL", () => {
    expect(getExplorerTransactionUrl("testnet", "abc123")).toBe(
      "https://explorer.testnet.near.org/transactions/abc123",
    );
  });

  it("returns a mainnet explorer URL", () => {
    expect(getExplorerTransactionUrl("mainnet", "xyz789")).toBe(
      "https://explorer.near.org/transactions/xyz789",
    );
  });

  it("URL-encodes special characters in the hash", () => {
    const url = getExplorerTransactionUrl("testnet", "hash with spaces");
    expect(url).toBe(
      "https://explorer.testnet.near.org/transactions/hash%20with%20spaces",
    );
  });

  it("returns undefined for an empty transaction hash", () => {
    expect(getExplorerTransactionUrl("testnet", "")).toBeUndefined();
  });
});
