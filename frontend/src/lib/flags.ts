/**
 * Feature flags derived from public (`NEXT_PUBLIC_*`) environment variables.
 *
 * These are safe to evaluate on both the server and the client. Each flag must
 * reference `process.env.NEXT_PUBLIC_*` *statically* so Next.js can inline the
 * value at build time.
 */

/** Truthy flag values: `true`, `1`, `on`, `enabled` (case-insensitive). */
function isFlagOn(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "true" ||
    normalized === "1" ||
    normalized === "on" ||
    normalized === "enabled"
  );
}

/**
 * `/trade-demo` route.
 *
 * The trade demo renders a fixed roster of fake players (`MOCK_PLAYERS`) so the
 * `TradeModal` can be exercised in isolation. It is **not** backed by a real
 * economy, so it must never be reachable in a production deployment unless it is
 * explicitly turned on for a preview/QA environment.
 *
 * Off by default. Enable with `NEXT_PUBLIC_TRADE_DEMO=true`.
 */
export function isTradeDemoEnabled(): boolean {
  return isFlagOn(process.env.NEXT_PUBLIC_TRADE_DEMO);
}
