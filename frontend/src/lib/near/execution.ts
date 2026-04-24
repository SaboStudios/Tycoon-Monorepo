import type { FinalExecutionOutcome } from "@near-wallet-selector/core";

export function getTransactionHashFromOutcome(
  outcome: FinalExecutionOutcome,
): string | undefined {
  const id = outcome.transaction_outcome?.id;
  return id !== undefined && id !== "" ? id : undefined;
}

export function isFinalExecutionSuccess(outcome: FinalExecutionOutcome): boolean {
  const { status } = outcome;
  if (status === "Failure") return false;
  if (typeof status === "object" && status !== null && "Failure" in status) {
    const failure = (status as { Failure?: unknown }).Failure;
    return failure === undefined || failure === null;
  }
  return true;
}
