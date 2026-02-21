import GameBoard from "@/components/game/GameBoard";

export default function GamePlayPage() {
  return (
    <section className="min-h-screen w-full bg-[var(--tycoon-bg)] flex flex-col items-center justify-center py-8 px-4">
      <h1 className="font-orbitron text-2xl font-bold text-[var(--tycoon-accent)] text-center mb-6 sr-only">
        Game Play
      </h1>
      <GameBoard />
    </section>
  );
}
