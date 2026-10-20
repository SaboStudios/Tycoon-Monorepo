/**
 * Privacy-safe telemetry hooks for NEAR wallet lifecycle events.
 *
 * Rules enforced here and by the analytics taxonomy (SW-FE-005):
 *  - No account IDs, wallet addresses, or transaction hashes are ever sent.
 *  - Only non-linkable fields: network_id, method_name, error_type.
 *  - All payloads pass through sanitizeAnalyticsPayload before dispatch,
 *    so any accidental PII field is stripped automatically.
 */

import { track } from "./client";
import type { NetworkId } from "@near-wallet-selector/core";

/** Fired once when a NEAR account becomes active in the selector. */
export function trackNearWalletConnected(networkId: NetworkId): void {
  track("near_wallet_connected", { network_id: networkId });
}

/** Fired when the user signs out of their NEAR wallet. */
export function trackNearWalletDisconnected(networkId: NetworkId): void {
  track("near_wallet_disconnected", { network_id: networkId });
}

/** Fired when a contract call is submitted (enters pending state). */
export function trackNearTxSubmitted(
  networkId: NetworkId,
  methodName: string,
): void {
  track("near_tx_submitted", { network_id: networkId, method_name: methodName });
}

/** Fired when a transaction is confirmed on-chain. */
export function trackNearTxConfirmed(
  networkId: NetworkId,
  methodName: string,
): void {
  track("near_tx_confirmed", { network_id: networkId, method_name: methodName });
}

/**
 * Fired when a transaction fails (on-chain failure, rejection, or no outcome).
 * `errorType` is a short non-PII classifier: "rejected" | "no_outcome" | "on_chain".
 */
export function trackNearTxFailed(
  networkId: NetworkId,
  methodName: string,
  errorType: "rejected" | "no_outcome" | "on_chain",
): void {
  track("near_tx_failed", {
    network_id: networkId,
    method_name: methodName,
    error_type: errorType,
  });
}
