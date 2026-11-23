'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { NetworkId, WalletSelector } from '@near-wallet-selector/core';
import { setupWalletSelector } from '@near-wallet-selector/core';
import { setupModal, type WalletSelectorModal } from '@near-wallet-selector/modal-ui';
import { setupMyNearWallet } from '@near-wallet-selector/my-near-wallet';

import { DEFAULT_FUNCTION_CALL_GAS, getNearContractId, getNearNetworkId } from '../../lib/near/config';
import { isLikelyUserRejectedError, nearErrorMessage } from '../../lib/near/errors';
import { getTransactionHashFromOutcome, isFinalExecutionSuccess } from '../../lib/near/execution';
import { getExplorerTransactionUrl } from '../../lib/near/explorer';
import type { NearTxRecord } from '../../lib/near/types';

/**
 * Thrown by `callContractMethod` when the wallet/user declines to sign. Kept
 * as a distinct error class (rather than a generic Error) so callers such as
 * the join form can map it to the `wallet_rejected` UI code instead of a
 * generic failure, and never send the user to an "install a wallet" link on
 * a rejection they already approved from an installed wallet.
 */
export class NearWalletRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NearWalletRejectedError';
  }
}

/**
 * Thrown by `connect()` / `callContractMethod` when no wallet selector is
 * available yet (selector failed to initialize, or no wallet module could be
 * used). Distinct from a rejection: this is "nothing to approve", not "the
 * user said no".
 */
export class NearWalletNotInstalledError extends Error {
  constructor(
    message = 'No NEAR wallet is available. Install or set up a NEAR wallet to continue.',
  ) {
    super(message);
    this.name = 'NearWalletNotInstalledError';
  }
}

export interface NearWalletContextValue {
  ready: boolean;
  initError: string | null;
  networkId: NetworkId;
  contractId: string;
  accountId: string | null;
  accounts: string[];
  transactions: NearTxRecord[];
  connect: () => void;
  disconnect: () => Promise<void>;
  callContractMethod: (
    methodName: string,
    args?: Record<string, unknown>,
    depositYocto?: string,
  ) => Promise<NearTxRecord>;
  clearTransactions: () => void;
}

export const NearWalletContext = createContext<NearWalletContextValue | null>(null);

export function useNearWallet(): NearWalletContextValue {
  const ctx = useContext(NearWalletContext);
  if (!ctx) {
    throw new Error('useNearWallet must be used within NearWalletProvider');
  }
  return ctx;
}

export interface NearWalletProviderProps {
  children: ReactNode;
}

function makeTxId(methodName: string): string {
  return `${methodName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function NearWalletProvider({ children }: NearWalletProviderProps) {
  const networkId = getNearNetworkId();
  const contractId = getNearContractId(networkId);

  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [transactions, setTransactions] = useState<NearTxRecord[]>([]);

  const selectorRef = useRef<WalletSelector | null>(null);
  const modalRef = useRef<WalletSelectorModal | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    async function init() {
      try {
        const selector = await setupWalletSelector({
          network: networkId,
          modules: [setupMyNearWallet()],
        });
        if (cancelled) return;

        selectorRef.current = selector;
        modalRef.current = setupModal(selector, { contractId });

        const subscription = selector.store.observable.subscribe((state: { accounts: Array<{ accountId: string }> }) => {
          const activeAccounts = state.accounts.map((account) => account.accountId);
          setAccounts(activeAccounts);
          setAccountId(activeAccounts[0] ?? null);
        });
        unsubscribe = () => subscription.unsubscribe();

        const initialState = selector.store.getState();
        const initialAccounts = initialState.accounts.map((account: { accountId: string }) => account.accountId);
        setAccounts(initialAccounts);
        setAccountId(initialAccounts[0] ?? null);
        setReady(true);
      } catch (error) {
        if (cancelled) return;
        setInitError(
          error instanceof Error ? error.message : 'Preparing NEAR wallet support failed.',
        );
        setReady(false);
      }
    }

    void init();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
    // Network/contract only change across reloads in practice; re-running
    // this effect on every render would tear down the selector pointlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = useCallback(() => {
    const modal = modalRef.current;
    if (!modal) {
      setInitError('Preparing NEAR wallet support. Try again in a moment.');
      return;
    }
    modal.show();
  }, []);

  const disconnect = useCallback(async () => {
    const selector = selectorRef.current;
    if (!selector) return;
    const wallet = await selector.wallet().catch(() => null);
    await wallet?.signOut().catch(() => undefined);
    setAccountId(null);
    setAccounts([]);
  }, []);

  const clearTransactions = useCallback(() => {
    setTransactions([]);
  }, []);

  const callContractMethod = useCallback(
    async (
      methodName: string,
      args: Record<string, unknown> = {},
      depositYocto = '0',
    ): Promise<NearTxRecord> => {
      const pendingRecord: NearTxRecord = {
        id: makeTxId(methodName),
        phase: 'pending',
        methodName,
        contractId,
      };
      // Only the latest transaction is ever displayed.
      setTransactions([pendingRecord]);

      const selector = selectorRef.current;
      if (!selector) {
        const message = 'No NEAR wallet is available. Install or set up a NEAR wallet to continue.';
        setTransactions([{ ...pendingRecord, phase: 'failed', errorMessage: message }]);
        throw new NearWalletNotInstalledError(message);
      }

      let wallet;
      try {
        wallet = await selector.wallet();
      } catch (error) {
        const message = 'No NEAR wallet is available. Install or set up a NEAR wallet to continue.';
        setTransactions([{ ...pendingRecord, phase: 'failed', errorMessage: message }]);
        throw new NearWalletNotInstalledError(message);
      }

      try {
        const outcome = await wallet.signAndSendTransaction({
          receiverId: contractId,
          actions: [
            {
              type: 'FunctionCall',
              params: {
                methodName,
                args,
                gas: DEFAULT_FUNCTION_CALL_GAS.toString(),
                deposit: depositYocto,
              },
            },
          ],
        });

        if (!outcome || !isFinalExecutionSuccess(outcome)) {
          const message = 'The transaction did not complete.';
          const record: NearTxRecord = { ...pendingRecord, phase: 'failed', errorMessage: message };
          setTransactions([record]);
          return record;
        }

        const hash = getTransactionHashFromOutcome(outcome);
        const explorerUrl = getExplorerTransactionUrl(networkId, hash);
        const record: NearTxRecord = {
          ...pendingRecord,
          phase: 'confirmed',
          hash,
          explorerUrl,
        };
        setTransactions([record]);
        return record;
      } catch (error) {
        const message = nearErrorMessage(error);
        setTransactions([{ ...pendingRecord, phase: 'failed', errorMessage: message }]);

        if (isLikelyUserRejectedError(error)) {
          // A rejection is not "no wallet" — never collapse this into the
          // not-installed error so the UI doesn't send an already-connected
          // user to an install link after they just declined to sign.
          throw new NearWalletRejectedError(message);
        }

        throw error instanceof Error ? error : new Error(message);
      }
    },
    [contractId, networkId],
  );

  const value: NearWalletContextValue = {
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
  };

  return <NearWalletContext.Provider value={value}>{children}</NearWalletContext.Provider>;
}

export default NearWalletProvider;
