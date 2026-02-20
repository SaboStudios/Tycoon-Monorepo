export default function GamePlayPage() {
  return (
    <main className="min-h-screen bg-[var(--tycoon-bg)] text-[var(--tycoon-text)] flex items-center justify-center px-4">
      <section className="w-full max-w-2xl rounded-2xl border border-[var(--tycoon-border)] bg-[var(--tycoon-card-bg)] p-8 text-center shadow-xl">
        <h1 className="font-orbitron text-3xl font-bold text-[var(--tycoon-accent)]">
          Game Play - Coming Soon
        </h1>
        <p className="mt-4 text-sm text-[var(--tycoon-text)]/80">
          Multiplayer game board flow will be mounted here.
        </p>
        <p className="mt-2 text-xs text-[var(--tycoon-text)]/60">
          Future-ready: room id support can be added via `?roomId=...` or a dynamic segment.
        </p>
      </section>
    </main>
  );
}
