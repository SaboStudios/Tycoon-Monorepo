import type { FinalExecutionOutcome } from "@near-wallet-selector/core";

export function getTransactionHashFromOutcome(
  outcome: FinalExecutionOutcome,
): string {
  return outcome.transaction_outcome?.id ?? "";
}

export function isFinalExecutionSuccess(outcome: FinalExecutionOutcome): boolean {
  const { status } = outcome;
  if (status === "Failure") return false;
  if (typeof status === "object" && status !== null && "Failure" in status) {
    return !status.Failure;
  }
  return true;
}
