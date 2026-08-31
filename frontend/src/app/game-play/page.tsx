import GameBoard from "@/components/game/GameBoard";
import BoostSocketListener from "@/components/game/BoostSocketListener";
import { generatePageMetadata } from "@/lib/metadata";
import type { Metadata } from "next";

export const metadata: Metadata = generatePageMetadata({
  title: "Play Game",
  description:
    "Play Tycoon online. Build your empire, trade properties, and become the ultimate tycoon.",
  canonicalPath: "/game-play",
  keywords: [
    "play tycoon",
    "board game",
    "property trading",
    "strategy game",
    "multiplayer game",
  ],
});

type GamePlayConnectionState = "ready" | "disconnected";

interface PageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

interface GamePlayContentProps {
  connectionState: GamePlayConnectionState;
  gameId: string | null;
}

function normalizeSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    const first: string | undefined = value[0];
    return first !== undefined ? first : undefined;
  }
  return value;
}

function parseGameId(raw: string | undefined): string | null {
  const trimmed: string = raw?.trim() ?? "";
  return trimmed.length > 0 ? trimmed.toUpperCase() : null;
}

function resolveConnectionState(
  stateParam: string | undefined,
): GamePlayConnectionState {
  const normalized: string = stateParam?.trim().toLowerCase() ?? "";
  if (normalized === "disconnected" || normalized === "stale") {
    return "disconnected";
  }
  return "ready";
}

function buildStatusAnnouncerText(
  connectionState: GamePlayConnectionState,
  gameId: string | null,
): string {
  if (connectionState === "disconnected") {
    return "Game disconnected. Reconnect to continue playing.";
  }
  if (gameId !== null) {
    return `Game session ${gameId} loaded.`;
  }
  return "Game board ready.";
}

function GamePlayContent({
  connectionState,
  gameId,
}: GamePlayContentProps): React.JSX.Element {
  const statusText: string = buildStatusAnnouncerText(connectionState, gameId);

  if (connectionState === "disconnected") {
    return (
      <main
        aria-label="Game disconnected"
        role="alert"
        className="mx-auto flex min-h-screen w-full max-w-[min(100%,var(--shell-content-max-game))] flex-col items-center justify-center bg-[var(--tycoon-bg)] px-4 py-8"
      >
        <h1 className="mb-4 text-center font-orbitron text-2xl font-bold text-[var(--tycoon-accent)]">
          Connection Lost
        </h1>
        <p className="mb-6 text-center text-[var(--tycoon-text-muted)]">
          Unable to load game state. Check your connection and try again.
        </p>
        <a
          href="/game-play"
          className="rounded focus:outline-none focus:ring-2 focus:ring-[var(--tycoon-accent)] focus:ring-offset-2 focus:ring-offset-[var(--tycoon-bg)] bg-[var(--tycoon-accent)] px-6 py-3 font-orbitron font-bold text-[var(--tycoon-bg)]"
        >
          Retry
        </a>
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {statusText}
        </div>
      </main>
    );
  }

  return (
    <main
      aria-label="Tycoon game play"
      className="mx-auto flex min-h-screen w-full max-w-[min(100%,var(--shell-content-max-game))] flex-col items-center justify-center bg-[var(--tycoon-bg)] px-4 py-8"
    >
      <a
        href="#game-board-region"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-[var(--tycoon-accent)] focus:px-4 focus:py-2 focus:text-[var(--tycoon-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--tycoon-accent)] focus:ring-offset-2 focus:ring-offset-[var(--tycoon-bg)]"
      >
        Skip to game board
      </a>

      <BoostSocketListener />

      <h1 className="sr-only mb-6 text-center font-orbitron text-2xl font-bold text-[var(--tycoon-accent)]">
        Game Play
      </h1>

      <div
        id="game-status-announcer"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-label="Game status updates"
        className="sr-only"
      >
        {statusText}
      </div>

      <section
        id="game-board-region"
        aria-label="Game board area"
        aria-busy={gameId === null ? undefined : true}
        className="w-full rounded-xl focus-within:ring-2 focus-within:ring-[var(--tycoon-accent)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--tycoon-bg)] [&_*:focus-visible]:outline-none [&_*:focus-visible]:ring-2 [&_*:focus-visible]:ring-[var(--tycoon-accent)] [&_*:focus-visible]:ring-offset-2"
      >
        <GameBoard />
      </section>
    </main>
  );
}

export default async function GamePlayPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params: Record<string, string | string[] | undefined> =
    searchParams !== undefined ? await searchParams : {};
  const stateParam: string | undefined = normalizeSearchParam(params.state);
  const gameIdParam: string | undefined = normalizeSearchParam(params.gameId);
  const connectionState: GamePlayConnectionState =
    resolveConnectionState(stateParam);
  const gameId: string | null = parseGameId(gameIdParam);

  return (
    <GamePlayContent connectionState={connectionState} gameId={gameId} />
  );
}
