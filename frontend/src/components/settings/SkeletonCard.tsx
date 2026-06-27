export function SkeletonCard() {
  return (
    <div
      className="animate-pulse rounded-xl border border-[var(--tycoon-border)] bg-[var(--tycoon-card-bg)] p-6 space-y-4"
      role="status"
      aria-label="Loading settings"
      aria-busy="true"
    >
      <div className="h-5 w-32 rounded bg-[var(--tycoon-border)]" />
      <div className="h-4 w-48 rounded bg-[var(--tycoon-border)] opacity-60" />
      <div className="space-y-3">
        <div className="h-10 rounded bg-[var(--tycoon-border)] opacity-40" />
        <div className="h-10 w-28 rounded bg-[var(--tycoon-border)] opacity-40" />
      </div>
    </div>
  );
}
