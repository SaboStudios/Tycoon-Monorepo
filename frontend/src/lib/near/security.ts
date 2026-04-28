/**
 * Security utilities for NEAR wallet interactions.
 * SW-FE-039: security hardening review.
 */

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
