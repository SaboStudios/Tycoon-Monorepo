/**
 * Game Play: CLS / LCP skeleton (#1483)
 *
 * Route-level loading.tsx rendered while the client-side GameBoard hydrates.
 * Mirrors the game-play page shell and the GameBoard container (square 11×11
 * grid, `min(92vw, 900px)` width) so the real board replaces this skeleton
 * without a visible layout shift. Purely presentational — fetches nothing.
 */
import { Skeleton } from "@/components/ui/skeleton";

const GRID_SIZE = 11;
const CENTER_START = 4;
const CENTER_END = 7;

function isCenterArea(row: number, col: number): boolean {
  return (
    row >= CENTER_START &&
    row < CENTER_END &&
    col >= CENTER_START &&
    col < CENTER_END
  );
}

function isTrackCell(row: number, col: number): boolean {
  return (
    row === 0 || row === GRID_SIZE - 1 || col === 0 || col === GRID_SIZE - 1
  );
}

export default function GamePlayLoading() {
  return (
    <main
      aria-label="Loading game board"
      className="mx-auto flex min-h-screen w-full max-w-[min(100%,var(--shell-content-max-game))] flex-col items-center justify-center bg-[var(--tycoon-bg)] px-4 py-8"
    >
      <section
        aria-busy="true"
        aria-label="Loading game board"
        className="w-full rounded-xl"
      >
        <div
          aria-hidden="true"
          className="relative w-full aspect-square mx-auto rounded-xl border-2 border-[var(--tycoon-border)] bg-[var(--tycoon-bg)] shadow-2xl overflow-hidden"
          style={{
            width: "min(92vw, 900px)",
            maxWidth: "900px",
          }}
        >
          <div
            className="absolute inset-0 grid gap-0 items-stretch justify-stretch"
            style={{
              gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => {
              const row = Math.floor(i / GRID_SIZE);
              const col = i % GRID_SIZE;

              if (isCenterArea(row, col)) {
                if (row === CENTER_START && col === CENTER_START) {
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-center p-1 bg-[var(--tycoon-bg)]"
                      style={{
                        gridColumn: `${col + 1} / ${col + 1 + (CENTER_END - CENTER_START)}`,
                        gridRow: `${row + 1} / ${row + 1 + (CENTER_END - CENTER_START)}`,
                      }}
                    >
                      <Skeleton className="h-full w-full rounded-lg" />
                    </div>
                  );
                }
                return <div key={i} className="col-span-1 row-span-1" aria-hidden />;
              }

              if (isTrackCell(row, col)) {
                return (
                  <div
                    key={i}
                    className="flex items-center justify-center p-0.5 sm:p-1 min-w-0 min-h-0 overflow-hidden"
                  >
                    <Skeleton className="h-full w-full" />
                  </div>
                );
              }

              return <div key={i} aria-hidden />;
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
