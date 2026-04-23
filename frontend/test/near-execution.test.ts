import { describe, expect, it } from "vitest";
import type { FinalExecutionOutcome } from "@near-wallet-selector/core";
import {
  getTransactionHashFromOutcome,
  isFinalExecutionSuccess,
} from "@/lib/near/execution";
import { getExplorerTransactionUrl } from "@/lib/near/explorer";

function makeOutcome(
  id: string | undefined,
  status: FinalExecutionOutcome["status"],
): FinalExecutionOutcome {
  return {
    status,
    transaction: {} as FinalExecutionOutcome["transaction"],
    transaction_outcome: id !== undefined ? ({ id } as FinalExecutionOutcome["transaction_outcome"]) : undefined as unknown as FinalExecutionOutcome["transaction_outcome"],
    receipts_outcome: [],
  };
}

describe("getTransactionHashFromOutcome", () => {
  it("returns the transaction id when present", () => {
    expect(getTransactionHashFromOutcome(makeOutcome("ABC123", "SuccessValue"))).toBe("ABC123");
  });

  it("returns undefined for empty string id", () => {
    expect(getTransactionHashFromOutcome(makeOutcome("", "SuccessValue"))).toBeUndefined();
  });

  it("returns undefined when transaction_outcome is missing", () => {
    expect(getTransactionHashFromOutcome(makeOutcome(undefined, "SuccessValue"))).toBeUndefined();
  });
});

describe("isFinalExecutionSuccess", () => {
  it("returns true for SuccessValue string status", () => {
    expect(isFinalExecutionSuccess(makeOutcome("x", "SuccessValue"))).toBe(true);
  });

  it("returns false for Failure string status", () => {
    expect(isFinalExecutionSuccess(makeOutcome("x", "Failure"))).toBe(false);
  });

  it("returns false when status object has a Failure key with a value", () => {
    const outcome = makeOutcome("x", { Failure: { error_type: "ActionError", error_message: "oops" } } as unknown as FinalExecutionOutcome["status"]);
    expect(isFinalExecutionSuccess(outcome)).toBe(false);
  });

  it("returns true when status object Failure is null", () => {
    const outcome = makeOutcome("x", { Failure: null } as unknown as FinalExecutionOutcome["status"]);
    expect(isFinalExecutionSuccess(outcome)).toBe(true);
  });
});

describe("getExplorerTransactionUrl", () => {
  it("builds a testnet explorer URL", () => {
    expect(getExplorerTransactionUrl("testnet", "ABC123")).toBe(
      "https://explorer.testnet.near.org/transactions/ABC123",
    );
  });

  it("builds a mainnet explorer URL", () => {
    expect(getExplorerTransactionUrl("mainnet", "XYZ")).toBe(
      "https://explorer.near.org/transactions/XYZ",
    );
  });

  it("returns undefined for an empty hash", () => {
    expect(getExplorerTransactionUrl("testnet", "")).toBeUndefined();
  });

  it("encodes special characters in the hash", () => {
    const url = getExplorerTransactionUrl("testnet", "a/b");
    expect(url).toBe("https://explorer.testnet.near.org/transactions/a%2Fb");
  });
});
