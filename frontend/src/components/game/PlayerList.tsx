"use client";

import React from "react";
import { Crown, Check, Clock } from "lucide-react";

/** Slot state for lobby/game */
export type SlotState = "ready" | "not_ready" | "host";

export interface PlayerSlot {
  id: string;
  name: string;
  symbol?: string;
  state?: SlotState;
}

/** Symbol value -> emoji mapping (Tycoon default symbols) */
const SYMBOL_EMOJI: Record<string, string> = {
  ship: "🚢",
  car: "🚗",
  plane: "✈️",
  truck: "🚚",
};

function getSymbolDisplay(symbol?: string): string {
  if (!symbol) return "❓";
  return SYMBOL_EMOJI[symbol] ?? symbol;
}

export interface PlayerListProps {
  /** Array of players (may be shorter than maxPlayers; empty slots render as "Open") */
  players: PlayerSlot[];
  /** Maximum number of slots (default 4). Renders this many slots. */
  maxPlayers?: number;
  /** Optional CSS class for the grid container */
  className?: string;
}

/**
 * Reusable player list for lobby/game.
 * Renders player slots; empty slots show "Open".
 * Supports slot states: ready, not_ready, host.
 * Uses Tycoon styling (cyan accent, dark card).
 */
export function PlayerList({
  players,
  maxPlayers = 4,
  className = "",
}: PlayerListProps): React.JSX.Element {
  const slots = Array.from({ length: maxPlayers }, (_, i) => players[i] ?? null);

  return (
    <div
      className={`grid grid-cols-2 sm:grid-cols-4 gap-3 justify-center ${className}`.trim()}
      data-testid="player-list"
    >
      {slots.map((player, index) => (
        <PlayerSlotCard key={player?.id ?? `empty-${index}`} player={player} index={index} />
      ))}
    </div>
  );
}

function PlayerSlotCard({
  player,
  index,
}: {
  player: PlayerSlot | null;
  index: number;
}): React.JSX.Element {
  const isEmpty = !player;

  return (
    <div
      className="bg-[#010F10]/70 p-3 rounded-lg border border-[#00F0FF]/30 flex flex-col items-center justify-center shadow-md hover:shadow-[#00F0FF]/50 transition-shadow duration-300 min-h-[88px]"
      data-slot-index={index}
      data-empty={isEmpty}
      data-state={player?.state ?? "empty"}
    >
      {/* Symbol or placeholder */}
      <span className="text-4xl mb-1" aria-hidden>
        {isEmpty ? "❓" : getSymbolDisplay(player.symbol)}
      </span>

      {/* Name or "Open" */}
      <p className="text-[#F0F7F7] text-xs font-semibold truncate max-w-[80px] text-center">
        {isEmpty ? "Open" : player.name}
      </p>

      {/* Slot state badge (host / ready / not ready) */}
      {!isEmpty && player.state && (
        <span
          className={`mt-1 flex items-center gap-0.5 text-[10px] font-orbitron ${
            player.state === "host"
              ? "text-amber-400"
              : player.state === "ready"
                ? "text-emerald-400"
                : "text-amber-200/80"
          }`}
        >
          {player.state === "host" && <Crown className="w-3 h-3" aria-hidden />}
          {player.state === "ready" && <Check className="w-3 h-3" aria-hidden />}
          {player.state === "not_ready" && <Clock className="w-3 h-3" aria-hidden />}
          <span>
            {player.state === "host"
              ? "Host"
              : player.state === "ready"
                ? "Ready"
                : "Not Ready"}
          </span>
        </span>
      )}
    </div>
  );
}

export default PlayerList;
