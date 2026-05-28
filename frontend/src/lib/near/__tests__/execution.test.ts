import { describe, it, expect } from "vitest";
import type { FinalExecutionOutcome } from "@near-wallet-selector/core";
import {
  getTransactionHashFromOutcome,
  isFinalExecutionSuccess,
} from "../execution";

function makeOutcome(
  id: string | undefined,
  status: FinalExecutionOutcome["status"],
): FinalExecutionOutcome {
  return {
    transaction_outcome: { id: id ?? "", outcome: {} as never, block_hash: "", proof: [] },
    transaction: {} as never,
    receipts_outcome: [],
    status,
  };
}

describe("getTransactionHashFromOutcome", () => {
  it("returns the transaction id when present", () => {
    const outcome = makeOutcome("abc123", "SuccessValue");
    expect(getTransactionHashFromOutcome(outcome)).toBe("abc123");
  });

  it("returns undefined when id is empty string", () => {
    const outcome = makeOutcome("", "SuccessValue");
    expect(getTransactionHashFromOutcome(outcome)).toBeUndefined();
  });

  it("returns undefined when transaction_outcome.id is undefined", () => {
    const outcome = makeOutcome(undefined, "SuccessValue");
    expect(getTransactionHashFromOutcome(outcome)).toBeUndefined();
  });
});

describe("isFinalExecutionSuccess", () => {
  it("returns true for string 'SuccessValue' status", () => {
    expect(isFinalExecutionSuccess(makeOutcome("x", "SuccessValue"))).toBe(true);
  });

  it("returns false for string 'Failure' status", () => {
    expect(isFinalExecutionSuccess(makeOutcome("x", "Failure"))).toBe(false);
  });

  it("returns true for object status with no Failure key", () => {
    const outcome = makeOutcome("x", { SuccessValue: "result" } as never);
    expect(isFinalExecutionSuccess(outcome)).toBe(true);
  });

  it("returns false for object status with Failure key set", () => {
    const outcome = makeOutcome("x", { Failure: { error_message: "oops" } } as never);
    expect(isFinalExecutionSuccess(outcome)).toBe(false);
  });

  it("returns true for object status with Failure key explicitly null", () => {
    const outcome = makeOutcome("x", { Failure: null } as never);
    expect(isFinalExecutionSuccess(outcome)).toBe(true);
  });
});
