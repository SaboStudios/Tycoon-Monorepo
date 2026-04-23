"use client";

import React from "react";
import { ExternalLink, Loader2, Wallet } from "lucide-react";
import { useNearWallet } from "@/components/providers/near-wallet-provider";
import { cn } from "@/lib/utils";

function truncateAccount(id: string, head = 6, tail = 4) {
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

type NearWalletConnectVariant = "navbar" | "panel";

export function NearWalletConnect({
  className,
  variant = "navbar",
}: {
  className?: string;
  /** `panel`: left-aligned for mobile slide-over menu. */
  variant?: NearWalletConnectVariant;
}) {
  const panel = variant === "panel";
  const {
    ready,
    initError,
    accountId,
    connect,
    disconnect,
    transactions,
  } = useNearWallet();

  const latest = transactions[0];

  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        panel ? "items-stretch text-left" : "items-end text-right",
        className,
      )}
    >
      {initError && (
        <span className="max-w-[220px] text-[10px] text-red-400 font-dm-sans">
          {initError}
        </span>
      )}

      {/* min-h reserves the button row height so surrounding layout does not
          shift when the wallet transitions between ready/not-ready states. */}
      <div
        className={cn(
          "flex min-h-[28px] flex-wrap items-center gap-2",
          panel ? "justify-start" : "justify-end",
        )}
      >
        {accountId ? (
          <>
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--tycoon-border)] bg-[var(--tycoon-card-bg)] px-3 py-1 text-[11px] font-dm-sans text-[var(--tycoon-text)]"
              title={accountId}
            >
              <Wallet className="h-3.5 w-3.5 text-[var(--tycoon-accent)]" />
              <span className="font-mono">{truncateAccount(accountId)}</span>
            </span>
            <button
              type="button"
              onClick={() => { void disconnect(); }}
              className="rounded-full border border-[var(--tycoon-border)] bg-transparent px-3 py-1 text-[11px] font-dm-sans text-[var(--tycoon-text)]/80 hover:text-[var(--tycoon-accent)] transition-colors"
            >
              Disconnect NEAR
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={connect}
            disabled={!ready}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--tycoon-card-bg)] border border-[var(--tycoon-border)] px-3 py-1.5 text-[11px] font-dm-sans font-medium text-[var(--tycoon-text)] hover:bg-[var(--tycoon-accent)] hover:text-[#010F10] transition-colors disabled:opacity-50"
          >
            <Wallet className="h-3.5 w-3.5" />
            Connect NEAR
          </button>
        )}
      </div>

      {/* min-h reserves space for the transaction status row so content below
          does not shift when a transaction appears or disappears (CLS). */}
      <div className={cn("min-h-[28px]", panel ? "items-start" : "items-end")}>
        {latest && (
          <div
            className={cn(
              "flex max-w-[280px] flex-col gap-0.5 rounded-lg border border-[var(--tycoon-border)]/80 bg-[#010F10]/80 px-2 py-1.5",
              panel ? "items-start" : "items-end",
            )}
          >
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-dm-sans text-[var(--tycoon-text)]/80">
              {latest.phase === "pending" && (
                <>
                  <Loader2 className="h-3 w-3 animate-spin text-[var(--tycoon-accent)]" />
                  <span>Transaction pending…</span>
                </>
              )}
              {latest.phase === "confirmed" && (
                <span className="text-emerald-400/90">Confirmed</span>
              )}
              {latest.phase === "failed" && (
                <span className="text-red-400/90">Failed</span>
              )}
              <span className="font-mono text-[var(--tycoon-text)]/60">
                {latest.methodName}
              </span>
            </div>
            {latest.errorMessage && (
              <span className="text-[10px] text-red-400/90">{latest.errorMessage}</span>
            )}
            {latest.hash && latest.explorerUrl && (
              <a
                href={latest.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-[var(--tycoon-accent)] hover:underline"
              >
                View on explorer
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
