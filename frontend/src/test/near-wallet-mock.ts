import type { NearWalletContextValue } from "@/components/providers/near-wallet-provider";

/** Deterministic mock for Vitest — no real NEAR wallet or selector. */
export function createMockNearWalletValue(
  overrides?: Partial<NearWalletContextValue>,
): NearWalletContextValue {
  return {
    ready: true,
    initError: null,
    connectError: null,
    disconnectError: null,
    networkId: "testnet",
    contractId: "guest-book.testnet",
    accountId: null,
    accounts: [],
    transactions: [],
    connect: () => {},
    disconnect: async () => {},
    clearError: () => {},
    callContractMethod: async () => undefined,
    clearTransactions: () => {},
    ...overrides,
  };
}
