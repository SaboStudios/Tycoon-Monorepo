"use client";

// Modal UI styles are loaded lazily inside the useEffect that bootstraps the
// wallet selector — keeping them off the critical CSS path improves LCP.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "react-toastify";
import type {
  Action,
  FinalExecutionOutcome,
  WalletSelector,
} from "@near-wallet-selector/core";
import type { WalletSelectorModal } from "@near-wallet-selector/modal-ui";
import {
  DEFAULT_FUNCTION_CALL_GAS,
  getNearContractId,
  getNearNetworkId,
} from "@/lib/near/config";
import {
  isLikelyUserRejectedError,
  nearErrorMessage,
  NEAR_SIGNATURE_REJECTED_MESSAGE,
} from "@/lib/near/errors";
import {
  getTransactionHashFromOutcome,
  isFinalExecutionSuccess,
} from "@/lib/near/execution";
import { getExplorerTransactionUrl } from "@/lib/near/explorer";
import type { NearTxRecord } from "@/lib/near/types";

export interface CallContractMethodParams {
  contractId: string;
  methodName: string;
  args: object;
  gas?: bigint;
  deposit?: bigint;
}

export interface NearWalletContextValue {
  ready: boolean;
  initError: string | null;
  networkId: ReturnType<typeof getNearNetworkId>;
  contractId: string;
  accountId: string | null;
  accounts: string[];
  transactions: NearTxRecord[];
  connect: () => void;
  disconnect: () => Promise<void>;
  callContractMethod: (
    params: CallContractMethodParams,
  ) => Promise<FinalExecutionOutcome | void>;
  clearTransactions: () => void;
}

const NearWalletContext = createContext<NearWalletContextValue | null>(null);

export function NearWalletProvider({ children }: { children: React.ReactNode }) {
  const networkId = useMemo(() => getNearNetworkId(), []);
  const contractId = useMemo(
    () => getNearContractId(networkId),
    [networkId],
  );

  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [transactions, setTransactions] = useState<NearTxRecord[]>([]);

  const selectorRef = useRef<WalletSelector | null>(null);
  const modalRef = useRef<WalletSelectorModal | null>(null);

  const syncAccounts = useCallback((selector: WalletSelector) => {
    const s = selector.store.getState();
    const active = s.accounts.find((a) => a.active);
    setAccountId(active?.accountId ?? null);
    setAccounts(s.accounts.map((a) => a.accountId));
  }, []);

  useEffect(() => {
    let cancelled = false;
    let subscription: { unsubscribe: () => void } | undefined;

    void (async () => {
      try {
        const [{ setupWalletSelector }, { setupModal }, { setupMyNearWallet }] =
          await Promise.all([
            import("@near-wallet-selector/core"),
            import("@near-wallet-selector/modal-ui"),
            import("@near-wallet-selector/my-near-wallet"),
            // Load modal CSS only when the selector is actually bootstrapped so
            // it stays off the critical CSS path and does not block LCP.
            import("@near-wallet-selector/modal-ui/styles.css"),
          ]);

        const selector = await setupWalletSelector({
          network: networkId,
          modules: [setupMyNearWallet()],
        });

        if (cancelled) return;

        const modal = setupModal(selector, {
          contractId,
          theme: "dark",
          description:
            "Connect a NEAR wallet (testnet or mainnet) for on-chain actions.",
        });

        selectorRef.current = selector;
        modalRef.current = modal;
        syncAccounts(selector);

        subscription = selector.store.observable.subscribe(() => {
          syncAccounts(selector);
        });

        setReady(true);
      } catch (e) {
        console.error(e);
        setInitError(nearErrorMessage(e));
      }
    })();

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, [contractId, networkId, syncAccounts]);

  const connect = useCallback(() => {
    modalRef.current?.show();
  }, []);

  const disconnect = useCallback(async () => {
    const selector = selectorRef.current;
    if (!selector) return;
    try {
      const wallet = await selector.wallet();
      await wallet.signOut();
    } catch (e) {
      toast.error(nearErrorMessage(e));
    }
  }, []);

  const clearTransactions = useCallback(() => {
    setTransactions([]);
  }, []);

  const callContractMethod = useCallback(
    async (params: CallContractMethodParams) => {
      const selector = selectorRef.current;
      if (!selector) {
        toast.error("NEAR wallet is not ready yet.");
        throw new Error("NEAR wallet is not ready");
      }

      const id = crypto.randomUUID();
      const pending: NearTxRecord = {
        id,
        phase: "pending",
        methodName: params.methodName,
        contractId: params.contractId,
      };
      setTransactions((prev) => [pending, ...prev].slice(0, 8));

      try {
        const wallet = await selector.wallet();
        const signerId =
          accountId ?? (await wallet.getAccounts())[0]?.accountId;
        if (!signerId) {
          throw new Error("Connect a NEAR wallet first.");
        }

        const gas = params.gas ?? DEFAULT_FUNCTION_CALL_GAS;
        const deposit = params.deposit ?? BigInt(0);

        const actions: Action[] = [
          {
            type: "FunctionCall",
            params: {
              methodName: params.methodName,
              args: params.args,
              gas: gas.toString(),
              deposit: deposit.toString(),
            },
          },
        ];

        const outcome = await wallet.signAndSendTransaction({
          signerId,
          receiverId: params.contractId,
          actions,
        });

        if (outcome === undefined || outcome === null) {
          setTransactions((prev) =>
            prev.map((t) =>
              t.id === id
                ? {
                    ...t,
                    phase: "failed",
                    errorMessage:
                      "No transaction result returned. If your wallet opened a new tab, finish there and try again.",
                  }
                : t,
            ),
          );
          return;
        }

        const hash = getTransactionHashFromOutcome(outcome);
        const success = isFinalExecutionSuccess(outcome);
        const explorerUrl = hash
          ? getExplorerTransactionUrl(networkId, hash)
          : undefined;

        setTransactions((prev) =>
          prev.map((t) =>
            t.id === id
              ? {
                  ...t,
                  phase: success ? "confirmed" : "failed",
                  hash,
                  explorerUrl,
                  errorMessage: success
                    ? undefined
                    : "The transaction was included but reported a failure on-chain.",
                }
              : t,
          ),
        );

        return outcome;
      } catch (e) {
        const msg = nearErrorMessage(e);
        if (isLikelyUserRejectedError(e)) {
          toast.error(NEAR_SIGNATURE_REJECTED_MESSAGE);
        } else {
          toast.error(msg);
        }
        setTransactions((prev) =>
          prev.map((t) =>
            t.id === id
              ? {
                  ...t,
                  phase: "failed",
                  errorMessage: msg,
                }
              : t,
          ),
        );
        throw e;
      }
    },
    [accountId, networkId],
  );

  const value = useMemo<NearWalletContextValue>(
    () => ({
      ready,
      initError,
      networkId,
      contractId,
      accountId,
      accounts,
      transactions,
      connect,
      disconnect,
      callContractMethod,
      clearTransactions,
    }),
    [
      ready,
      initError,
      networkId,
      contractId,
      accountId,
      accounts,
      transactions,
      connect,
      disconnect,
      callContractMethod,
      clearTransactions,
    ],
  );

  return (
    <NearWalletContext.Provider value={value}>
      {children}
    </NearWalletContext.Provider>
  );
}

export function useNearWallet(): NearWalletContextValue {
  const ctx = useContext(NearWalletContext);
  if (!ctx) {
    throw new Error("useNearWallet must be used within NearWalletProvider");
  }
  return ctx;
}

/** For tests: render with a custom provider value without initializing wallets. */
export { NearWalletContext };
