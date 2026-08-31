import GameWaitingClient from "@/clients/GameWaitingClient";
import { generatePageMetadata } from "@/lib/metadata";
import { fetchGameRoom } from "@/lib/api/games";
import type { Metadata } from "next";
import * as React from "react";

export const metadata: Metadata = generatePageMetadata({
  title: "Waiting for Players",
  description:
    "Waiting for other players to join the game. Get ready to start your Tycoon adventure.",
  canonicalPath: "/game-waiting",
  keywords: ["game lobby", "waiting room", "multiplayer", "game start"],
});

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * extended: format is valid AND backend confirms the room exists
 * invalid: format failed — skip the backend call entirely
 * not_found: backend returned 404
 * error: network/backend error — show waiting anyway (graceful degradation)
 */
type WaitingState = "waiting" | "invalid" | "not_found" | "error";

interface PageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

// ─── Pure helpers (testable without I/O) ─────────────────────────────────────

function normalizeSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    const first: string | undefined = value[0];
    return first !== undefined ? first : undefined;
  }
  return value;
}

function parseGameCode(raw: string | undefined): string | null {
  const trimmed: string = raw?.trim() ?? "";
  return trimmed.length > 0 ? trimmed.toUpperCase() : null;
}

/** Format-level guard only — backend is the authority for existence. */
function isValidCodeFormat(gameCode: string | null): boolean {
  if (gameCode === null) return false;
  return /^[A-Z0-9]{4,12}$/.test(gameCode);
}

function buildStatusText(
  waitingState: WaitingState,
  gameCode: string | null,
): string {
  if (waitingState === "not_found") {
    return `Game room "${gameCode ?? ""}" was not found. It may have ended or never existed.`;
  }
  if (waitingState === "invalid") {
    return "Invalid or missing game code. Please return to game settings.";
  }
  return `Waiting for players to join lobby ${gameCode ?? ""}.`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface GameWaitingContentProps {
  waitingState: WaitingState;
  gameCode: string | null;
}

function InvalidCodeView({
  statusText,
}: {
  statusText: string;
}): React.JSX.Element {
  return (
    <main
      aria-label="Game waiting — invalid state"
      role="alert"
      className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-x-hidden bg-[#010F10] px-4"
    >
      <h1 className="mb-4 text-center font-orbitron text-2xl font-bold text-[#00F0FF]">
        Invalid Game Code
      </h1>
      <p className="mb-6 text-center text-[#869298]">
        No valid game code was provided. Please go back and create a lobby.
      </p>
      <a
        href="/game-settings"
        className="rounded bg-[#00F0FF] px-6 py-3 font-orbitron font-bold text-[#010F10] focus:outline-none focus:ring-2 focus:ring-[#00F0FF] focus:ring-offset-2 focus:ring-offset-[#010F10]"
      >
        Back to Game Settings
      </a>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {statusText}
      </div>
    </main>
  );
}

function NotFoundView({
  gameCode,
  statusText,
}: {
  gameCode: string | null;
  statusText: string;
}): React.JSX.Element {
  return (
    <main
      aria-label="Game waiting — room not found"
      role="alert"
      data-testid="game-waiting-not-found"
      className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-x-hidden bg-[#010F10] px-4"
    >
      <h1 className="mb-4 text-center font-orbitron text-2xl font-bold text-[#00F0FF]">
        Room Not Found
      </h1>
      <p className="mb-2 text-center text-[#869298]">
        No game room with code{" "}
        <span className="font-mono font-bold text-[#00F0FF]">
          {gameCode ?? ""}
        </span>{" "}
        was found.
      </p>
      <p className="mb-6 text-center text-[#869298]">
        The room may have ended or the code is incorrect.
      </p>
      <a
        href="/game-settings"
        className="rounded bg-[#00F0FF] px-6 py-3 font-orbitron font-bold text-[#010F10] focus:outline-none focus:ring-2 focus:ring-[#00F0FF] focus:ring-offset-2 focus:ring-offset-[#010F10]"
      >
        Back to Game Settings
      </a>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {statusText}
      </div>
    </main>
  );
}

function WaitingView({
  gameCode,
  statusText,
}: {
  gameCode: string;
  statusText: string;
}): React.JSX.Element {
  return (
    <main
      aria-label="Game waiting lobby"
      aria-busy="true"
      className="relative min-h-screen w-full overflow-x-hidden bg-[#010F10]"
    >
      <a
        href="#game-waiting-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-[#00F0FF] focus:px-4 focus:py-2 focus:font-bold focus:text-[#010F10] focus:outline-none focus:ring-2 focus:ring-[#00F0FF] focus:ring-offset-2 focus:ring-offset-[#010F10]"
      >
        Skip to waiting lobby
      </a>

      <h1 className="sr-only">Waiting for Players</h1>

      <div
        id="game-waiting-status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-label="Lobby status updates"
        className="sr-only"
      >
        {statusText}
      </div>

      <section
        id="game-waiting-content"
        aria-label="Game waiting lobby content"
        data-game-code={gameCode}
        className="h-full w-full [&_*:focus-visible]:outline-none [&_*:focus-visible]:ring-2 [&_*:focus-visible]:ring-[#00F0FF] [&_*:focus-visible]:ring-offset-2 [&_*:focus-visible]:ring-offset-[#010F10]"
      >
        <GameWaitingClient />
      </section>
    </main>
  );
}

function GameWaitingContent({
  waitingState,
  gameCode,
}: GameWaitingContentProps): React.JSX.Element {
  const statusText: string = buildStatusText(waitingState, gameCode);

  if (waitingState === "invalid") {
    return <InvalidCodeView statusText={statusText} />;
  }

  if (waitingState === "not_found") {
    return <NotFoundView gameCode={gameCode} statusText={statusText} />;
  }

  // "waiting" or "error" (graceful degradation — show the lobby even if backend
  // was unreachable so we don't gate valid users behind a flaky network call)
  return <WaitingView gameCode={gameCode ?? ""} statusText={statusText} />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function GameWaitingPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params: Record<string, string | string[] | undefined> =
    searchParams !== undefined ? await searchParams : {};
  const rawGameCode: string | undefined = normalizeSearchParam(params.gameCode);
  const gameCode: string | null = parseGameCode(rawGameCode);

  // 1. Format check — skip backend call for clearly invalid codes
  if (!isValidCodeFormat(gameCode)) {
    return (
      <GameWaitingContent waitingState="invalid" gameCode={gameCode} />
    );
  }

  // 2. Backend existence check — gameCode is non-null here (format valid)
  const result = await fetchGameRoom(gameCode!);

  if (!result.found && result.reason === "not_found") {
    return (
      <GameWaitingContent waitingState="not_found" gameCode={gameCode} />
    );
  }

  if (!result.found && result.reason === "network_error") {
    // Graceful degradation: don't block valid users due to transient backend
    // errors. Show the waiting room; the real-time socket will catch up.
    return (
      <GameWaitingContent waitingState="error" gameCode={gameCode} />
    );
  }

  return <GameWaitingContent waitingState="waiting" gameCode={gameCode} />;
}

// ─── Exports for test access ──────────────────────────────────────────────────
export {
  parseGameCode,
  isValidCodeFormat,
  normalizeSearchParam,
  buildStatusText,
};
