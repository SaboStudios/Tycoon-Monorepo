"use client";

import { useEffect, useRef, useState } from "react";
import { Game } from "@/types/game";

const STORAGE_KEY_PREFIX = "tycoon_game_end_";

function getEndTimeMs(game: Game): number | null {
  const durationMinutes = Number(game?.duration ?? 0);
  if (durationMinutes <= 0) return null;
  // Multiplayer: timing starts when all players join and game is RUNNING (started_at).
  // Fall back to created_at for older games or AI.
  const startAt = game?.started_at || game?.created_at;
  if (!startAt) return null;
  const startMs = new Date(startAt).getTime();
  return startMs + durationMinutes * 60 * 1000;
}

function formatRemaining(remainingSeconds: number): string {
  if (remainingSeconds <= 0) return "0:00";
  const m = Math.floor(remainingSeconds / 60);
  const s = Math.floor(remainingSeconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export interface GameDurationCountdownProps {
  game: Game | null;
  className?: string;
  /** Compact style (e.g. for mobile bar) */
  compact?: boolean;
  /** Called once when countdown reaches 0 (e.g. to end AI game by net worth) */
  onTimeUp?: () => void | Promise<void>;
}

/**
 * Shows game duration as a countdown (time left). Uses game.created_at + game.duration (minutes).
 * Only visible when game is RUNNING and duration > 0.
 */
export function GameDurationCountdown({ game, className = "", compact, onTimeUp }: GameDurationCountdownProps) {
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const timeUpFiredRef = useRef(false);

  useEffect(() => {
    if (!game || game.status !== "RUNNING") {
      setRemainingSeconds(null);
      timeUpFiredRef.current = false;
      return;
    }

    const endMs = getEndTimeMs(game);
    if (endMs == null) {
      setRemainingSeconds(null);
      return;
    }

    const update = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((endMs - now) / 1000));
      setRemainingSeconds(remaining);
      if (remaining === 0 && onTimeUp && !timeUpFiredRef.current) {
        timeUpFiredRef.current = true;
        void Promise.resolve(onTimeUp()).catch(() => {});
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [game?.id, game?.status, game?.started_at, game?.created_at, game?.duration, onTimeUp]);

  if (remainingSeconds === null) return null;

  const label = compact ? "⏱" : "Time left";
  const value = formatRemaining(remainingSeconds);
  const isLow = remainingSeconds <= 60;

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border ${
        isLow
          ? "border-red-500/60 bg-red-950/40 text-red-300"
          : "border-cyan-500/40 bg-cyan-950/30 text-cyan-200"
      } ${className}`}
      title={compact ? `Time left: ${value}` : undefined}
    >
      <span className={`text-sm ${compact ? "font-bold" : "font-medium"}`}>{label}</span>
      <span className={`font-mono tabular-nums ${compact ? "text-sm font-extrabold" : "text-base font-bold"}`}>
        {value}
      </span>
    </div>
  );
}
