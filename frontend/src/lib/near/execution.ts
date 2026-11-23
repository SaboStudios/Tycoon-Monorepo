import type { FinalExecutionOutcome } from "@near-wallet-selector/core";

/**
 * True when the outcome's status carries no `Failure` field — i.e. the
 * transaction succeeded on-chain. Uses an explicit undefined/null check
 * rather than a loose truthiness coercion on `!status.Failure`, which would
 * treat a falsy-but-present failure payload (e.g. `0`) as success.
 */
export function isFinalExecutionSuccess(outcome: FinalExecutionOutcome): boolean {
  const status = outcome.status as { Failure?: unknown } | undefined;
  const failure = status?.Failure;
  return failure === undefined || failure === null;
}

/**
 * Returns the transaction hash, or `undefined` when it is missing or empty
 * rather than silently returning an empty string (which would produce a
 * silently broken explorer link downstream).
 */
export function getTransactionHashFromOutcome(
  outcome: FinalExecutionOutcome,
): string | undefined {
  const hash = outcome.transaction?.hash;
  return typeof hash === "string" && hash.length > 0 ? hash : undefined;
}
