import type { NetworkId } from "@near-wallet-selector/core";

const EXPLORER_BASE_URL: Record<NetworkId, string> = {
  testnet: "https://explorer.testnet.near.org",
  mainnet: "https://explorer.near.org",
};

/**
 * Builds the NEAR Explorer URL for a transaction hash. Returns `undefined`
 * when the hash is missing or empty, preventing a silently broken explorer
 * link from being rendered.
 */
export function getExplorerTransactionUrl(
  networkId: NetworkId,
  hash: string | undefined,
): string | undefined {
  if (!hash) return undefined;
  return `${EXPLORER_BASE_URL[networkId]}/transactions/${hash}`;
}
