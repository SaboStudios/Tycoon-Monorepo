/**
 * Security utilities for NEAR wallet interactions.
 * SW-FE-039: security hardening review.
 */

import type { NetworkId } from "@near-wallet-selector/core";

/**
 * Maximum safe deposit: 1 NEAR = 10^24 yoctoNEAR.
 * Prevents accidental fund loss from typos in deposit amounts.
 */
export const MAX_DEPOSIT_YOCTO = BigInt("1000000000000000000000000"); // 1 NEAR

/**
 * Returns true if the deposit is within the safe upper bound.
 */
export function isDepositSafe(deposit: bigint): boolean {
  return deposit >= BigInt(0) && deposit <= MAX_DEPOSIT_YOCTO;
}

// Matches BIP-39-style word sequences (12+ lowercase words) that could be seed phrases.
const SEED_PHRASE_RE = /\b([a-z]{3,8}\s){11,}[a-z]{3,8}\b/;
// Matches base58 strings of 64+ chars (NEAR ed25519 private keys are base58-encoded).
const PRIVATE_KEY_RE = /[1-9A-HJ-NP-Za-km-z]{64,}/;

/**
 * Truncates an error message and strips patterns that resemble seed phrases
 * or private keys before the message is stored in state or shown in the UI.
 */
export function sanitizeErrorMessage(msg: string, maxLen = 200): string {
  let safe = msg.replace(SEED_PHRASE_RE, "[redacted]").replace(PRIVATE_KEY_RE, "[redacted]");
  if (safe.length > maxLen) safe = safe.slice(0, maxLen) + "…";
  return safe;
}

// ── Contract-ID network allowlist ────────────────────────────────────────────

/**
 * Named-account NEAR IDs end with ".near" (mainnet top-level registrar).
 * Implicit accounts are 64-char lowercase hex strings (testnet & mainnet).
 * Testnet subaccounts always end with ".testnet".
 *
 * Mainnet indicators: top-level ".near" suffix, OR any second-level ".near.*"
 * subaccount that does NOT end in ".testnet".
 *
 * We use a conservative heuristic: any ID that ends with ".near" (but NOT
 * ".testnet") is considered a mainnet-style ID.
 */
const MAINNET_ID_RE = /\.near$/i;
const TESTNET_ID_RE = /\.testnet$/i;

/**
 * Returns true when the given contract ID looks like a mainnet account.
 * ".near" top-level accounts are mainnet-only.
 */
export function isLikelyMainnetId(contractId: string): boolean {
  return MAINNET_ID_RE.test(contractId) && !TESTNET_ID_RE.test(contractId);
}

/**
 * Returns true when the given contract ID looks like a testnet account.
 * (This is not exhaustive — implicit/64-hex IDs are valid on both networks.)
 */
export function isLikelyTestnetId(contractId: string): boolean {
  return TESTNET_ID_RE.test(contractId);
}

/**
 * Throws a clear error if a mainnet-style contract ID is used while the app
 * is configured for testnet. This prevents accidental real-money calls during
 * development or misconfigured builds.
 *
 * Call this before any wallet sign-in or contract call is initiated.
 *
 * @throws Error – when a mainnet ID is detected on a testnet-configured build.
 */
export function assertContractIdForNetwork(
  contractId: string,
  networkId: NetworkId,
): void {
  if (networkId === "testnet" && isLikelyMainnetId(contractId)) {
    throw new Error(
      `Contract ID "${contractId}" looks like a mainnet account but ` +
        `NEXT_PUBLIC_NEAR_NETWORK is set to "testnet". ` +
        `Use a testnet contract ID (e.g. "mycontract.testnet") or set ` +
        `NEXT_PUBLIC_NEAR_NETWORK=mainnet to target the mainnet.`,
    );
  }
}
