'use client';

import type { NearTxRecord } from '../../lib/near/types';
import { useNearWallet } from '../providers/near-wallet-provider';

export interface NearWalletConnectProps {
  variant?: 'navbar' | 'panel';
}

function truncateAccountId(accountId: string): string {
  if (accountId.length <= 20) return accountId;
  return `${accountId.slice(0, 10)}…${accountId.slice(-6)}`;
}

function NearTxStatus({ record }: { record: NearTxRecord }) {
  if (record.phase === 'pending') {
    return (
      <p
        className="near-wallet-connect__tx near-wallet-connect__tx--pending text-xs text-gray-500"
        data-testid="near-wallet-tx-pending"
      >
        Transaction pending: {record.methodName}
      </p>
    );
  }

  if (record.phase === 'failed') {
    return (
      <p
        className="near-wallet-connect__tx near-wallet-connect__tx--failed text-xs text-red-600"
        data-testid="near-wallet-tx-failed"
      >
        Transaction failed
        {record.errorMessage ? <span>{record.errorMessage}</span> : null}
      </p>
    );
  }

  return (
    <p
      className="near-wallet-connect__tx near-wallet-connect__tx--confirmed text-xs text-green-600"
      data-testid="near-wallet-tx-confirmed"
    >
      Transaction confirmed: {record.methodName}
      {record.hash && record.explorerUrl ? (
        <>
          {' '}
          <a href={record.explorerUrl} target="_blank" rel="noopener noreferrer">
            View on explorer
          </a>
        </>
      ) : null}
    </p>
  );
}

export function NearWalletConnect({ variant = 'navbar' }: NearWalletConnectProps) {
  const { ready, initError, accountId, connect, disconnect, transactions } = useNearWallet();

  const alignmentClasses = variant === 'panel' ? 'items-stretch text-left' : 'items-end text-right';
  const latestTransaction = transactions[transactions.length - 1];

  return (
    <div className={`near-wallet-connect flex flex-col gap-1 ${alignmentClasses}`}>
      <div className="near-wallet-connect__row flex min-h-[28px] items-center gap-2">
        {accountId ? (
          <>
            <span
              className="near-wallet-connect__account truncate"
              title={accountId}
              aria-label={`Connected as ${accountId}`}
            >
              {truncateAccountId(accountId)}
            </span>
            <button
              type="button"
              onClick={() => {
                void disconnect();
              }}
              aria-label={`Disconnect NEAR wallet ${accountId}`}
            >
              Disconnect NEAR
            </button>
          </>
        ) : (
          <button type="button" onClick={connect} disabled={!ready}>
            Connect NEAR
          </button>
        )}
      </div>

      {!accountId ? (
        initError ? (
          <p role="alert" className="near-wallet-connect__init-error text-xs text-red-600">
            {initError}
          </p>
        ) : (
          <div
            data-testid="near-wallet-empty-state"
            className="near-wallet-connect__empty text-xs text-gray-500"
          >
            {ready ? (
              <>
                <p>No NEAR wallet connected yet.</p>
                <p>Connect to sign in and submit transactions.</p>
              </>
            ) : (
              <p>{'Preparing NEAR wallet support…'}</p>
            )}
          </div>
        )
      ) : null}

      <div
        className="near-wallet-connect__status min-h-[28px]"
        aria-live="polite"
        aria-atomic="true"
      >
        {latestTransaction ? <NearTxStatus record={latestTransaction} /> : null}
      </div>
    </div>
  );
}

export default NearWalletConnect;
