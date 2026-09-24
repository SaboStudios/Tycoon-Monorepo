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

/** Contract used for wallet sign-in (function-call access key). */
export function getNearContractId(networkId: NetworkId = getNearNetworkId()): string {
  const fromEnv = process.env.NEXT_PUBLIC_NEAR_CONTRACT_ID?.trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_CONTRACT[networkId];
}

/** Default gas for simple contract calls (30 Tgas). */
export const DEFAULT_FUNCTION_CALL_GAS = BigInt("30000000000000");
