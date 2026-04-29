import type { NetworkId } from "@near-wallet-selector/core";

const DEFAULT_CONTRACT: Record<NetworkId, string> = {
  testnet: "guest-book.testnet",
  mainnet: "social.near",
};

export function getNearNetworkId(): NetworkId {
  const raw = process.env.NEXT_PUBLIC_NEAR_NETWORK?.toLowerCase();
  if (raw === "mainnet") return "mainnet";
  return "testnet";
}

/**
 * Validate a NEAR account ID: 2–64 chars, alphanumeric / hyphen / underscore / dot.
 * Rejects empty strings and values that look like injection attempts.
 */
export function isValidNearAccountId(id: string): boolean {
  return /^[a-z0-9_\-.]{2,64}$/.test(id);
}

/** Contract used for wallet sign-in (function-call access key). */
export function getNearContractId(networkId: NetworkId = getNearNetworkId()): string {
  const fromEnv = process.env.NEXT_PUBLIC_NEAR_CONTRACT_ID?.trim();
  if (fromEnv) {
    if (!isValidNearAccountId(fromEnv)) {
      // Avoid echoing the raw value in production logs (could expose internal config).
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[NEAR] NEXT_PUBLIC_NEAR_CONTRACT_ID "${fromEnv}" is not a valid NEAR account ID. Falling back to default.`,
        );
      } else {
        console.warn("[NEAR] NEXT_PUBLIC_NEAR_CONTRACT_ID is invalid. Falling back to default.");
      }
      return DEFAULT_CONTRACT[networkId];
    }
    return fromEnv;
  }
  return DEFAULT_CONTRACT[networkId];
}

/** Default gas for simple contract calls (30 Tgas). */
export const DEFAULT_FUNCTION_CALL_GAS = BigInt("30000000000000");
