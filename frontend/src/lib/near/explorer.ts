import type { NetworkId } from "@near-wallet-selector/core";

const EXPLORER_BASE: Record<NetworkId, string> = {
  testnet: "https://explorer.testnet.near.org",
  mainnet: "https://explorer.near.org",
};

export function getExplorerTransactionUrl(
  networkId: NetworkId,
  transactionHash: string,
): string {
  const base = EXPLORER_BASE[networkId];
  return `${base}/transactions/${encodeURIComponent(transactionHash)}`;
}
