export default function GamePlayPage() {
  return (
    <section className="min-h-screen w-full bg-[var(--tycoon-bg)] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--tycoon-border)] bg-[var(--tycoon-card-bg)] p-6 shadow-xl">
        <h1 className="font-orbitron text-2xl font-bold text-[var(--tycoon-accent)] text-center">
          Game Play - Coming Soon
        </h1>
        <p className="mt-4 text-center text-sm text-[var(--tycoon-text)]/80">
          Multiplayer game board flow will be mounted here.
        </p>
        <p className="mt-2 text-center text-xs text-[var(--tycoon-text)]/60">
          Future-ready: support `roomId` via query param or dynamic segment.
        </p>
      </div>
    </section>
  );
}
