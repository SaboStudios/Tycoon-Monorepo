              className="rounded-full border border-[var(--tycoon-border)] bg-transparent px-3 py-1 text-[11px] font-dm-sans text-[var(--tycoon-text)]/80 transition-colors hover:text-[var(--tycoon-accent)]"
            </span>
            <button
              type="button"
              onClick={() => {
                void disconnect();
              }}
              aria-label={`Disconnect NEAR wallet ${accountId}`}
              className="rounded-full border border-[var(--tycoon-border)] bg-transparent px-3 py-1 text-[11px] font-dm-sans text-[var(--tycoon-text)]/80 transition-colors hover:text-[var(--tycoon-accent)]"
            >
              Disconnect NEAR
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={connect}
            disabled={!ready}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--tycoon-border)] bg-[var(--tycoon-card-bg)] px-3 py-1.5 text-[11px] font-dm-sans font-medium text-[var(--tycoon-text)] transition-colors hover:bg-[var(--tycoon-accent)] hover:text-[#010F10] disabled:opacity-50"
          >
            <Wallet aria-hidden="true" className="h-3.5 w-3.5" />
            Connect NEAR
          </button>
        )}
      </div>

      {showLoadingState && (
        <div
          data-testid="near-wallet-empty-state"
          className={cn(
            "flex max-w-[240px] items-start gap-2 rounded-lg border border-[var(--tycoon-border)]/80 bg-[var(--tycoon-card-bg)]/70 px-3 py-2 text-left text-[10px] font-dm-sans text-[var(--tycoon-text)]/70",
            panel ? "self-start" : "self-end",
          )}
        >
          <Loader2
            aria-hidden="true"
            className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-[var(--tycoon-accent)]"
          />
          <span className="leading-relaxed">
            Preparing NEAR wallet support...
          </span>
        </div>
      )}

      {showEmptyState && (
        <div
          data-testid="near-wallet-empty-state"
          className={cn(
            "flex max-w-[240px] items-start gap-2 rounded-lg border border-[var(--tycoon-border)]/80 bg-[var(--tycoon-card-bg)]/70 px-3 py-2 text-left text-[10px] font-dm-sans text-[var(--tycoon-text)]/70",
            panel ? "self-start" : "self-end",
          )}
        >
          <Wallet
            aria-hidden="true"
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--tycoon-accent)]"
          />
          <span className="leading-relaxed">
            No NEAR wallet connected yet. Connect to sign in and submit
            transactions.
          </span>
        </div>
      )}

      {/* aria-live="polite" announces transaction status changes without
          interrupting the user. role="status" is implied by aria-live but
          explicit here for clarity. min-h prevents CLS. */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className={cn("min-h-[28px]", panel ? "items-start" : "items-end")}
      >
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
                  <Loader2
                    aria-hidden="true"
                    className="h-3 w-3 animate-spin text-[var(--tycoon-accent)]"
                  />
                  <span>Transaction pending...</span>
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
              <span className="text-[10px] text-red-400/90">
                {latest.errorMessage}
              </span>
            )}
            {latest.hash && latest.explorerUrl && (
              <a
                href={latest.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-[var(--tycoon-accent)] hover:underline"
              >
                View on explorer
                <ExternalLink aria-hidden="true" className="h-3 w-3" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default NearWalletConnect;
