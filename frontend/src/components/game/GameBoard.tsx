/**
 * Game board layout: classic Monopoly-style 11×11 grid with perimeter track
 * and CenterArea in the middle. Tycoon theme, responsive (desktop first).
 */
"use client";

import React from "react";
import { BoardSquare } from "./BoardSquare";
import type { SquareType } from "./BoardSquare";
import CenterArea from "./CenterArea";

const GRID_SIZE = 11;
const CENTER_START = 4;
const CENTER_END = 7;

export interface TrackSquareConfig {
  position: number;
  name: string;
  type: SquareType;
  color?: string;
}

/** Classic 40-square track: GO → right (bottom) → up (right) → left (top) → down (left) → back to GO */
const TRACK_CONFIG: TrackSquareConfig[] = [
  { position: 0, name: "GO", type: "go" },
  { position: 1, name: "Mediterranean", type: "property", color: "bg-[#8B4513]" },
  { position: 2, name: "Community", type: "community" },
  { position: 3, name: "Baltic", type: "property", color: "bg-[#8B4513]" },
  { position: 4, name: "Income Tax", type: "tax" },
  { position: 5, name: "Reading RR", type: "property", color: "bg-gray-700" },
  { position: 6, name: "Oriental", type: "property", color: "bg-[#87CEEB]" },
  { position: 7, name: "Chance", type: "chance" },
  { position: 8, name: "Vermont", type: "property", color: "bg-[#87CEEB]" },
  { position: 9, name: "Connecticut", type: "property", color: "bg-[#87CEEB]" },
  { position: 10, name: "Jail", type: "corner" },
  { position: 11, name: "St. Charles", type: "property", color: "bg-[#CD853F]" },
  { position: 12, name: "Electric", type: "property", color: "bg-gray-700" },
  { position: 13, name: "States", type: "property", color: "bg-[#CD853F]" },
  { position: 14, name: "Virginia", type: "property", color: "bg-[#CD853F]" },
  { position: 15, name: "Penn RR", type: "property", color: "bg-gray-700" },
  { position: 16, name: "St. James", type: "property", color: "bg-[#FF6347]" },
  { position: 17, name: "Community", type: "community" },
  { position: 18, name: "Tennessee", type: "property", color: "bg-[#FF6347]" },
  { position: 19, name: "New York", type: "property", color: "bg-[#FF6347]" },
  { position: 20, name: "Free Parking", type: "corner" },
  { position: 21, name: "Kentucky", type: "property", color: "bg-[#FFD700]" },
  { position: 22, name: "Chance", type: "chance" },
  { position: 23, name: "Indiana", type: "property", color: "bg-[#FFD700]" },
  { position: 24, name: "Illinois", type: "property", color: "bg-[#FFD700]" },
  { position: 25, name: "B&O RR", type: "property", color: "bg-gray-700" },
  { position: 26, name: "Atlantic", type: "property", color: "bg-[#FF69B4]" },
  { position: 27, name: "Ventnor", type: "property", color: "bg-[#FF69B4]" },
  { position: 28, name: "Water Works", type: "property", color: "bg-gray-700" },
  { position: 29, name: "Marvin Gardens", type: "property", color: "bg-[#FF69B4]" },
  { position: 30, name: "Go to Jail", type: "jail" },
  { position: 31, name: "Pacific", type: "property", color: "bg-[#FF4500]" },
  { position: 32, name: "North Carolina", type: "property", color: "bg-[#FF4500]" },
  { position: 33, name: "Community", type: "community" },
  { position: 34, name: "Pennsylvania", type: "property", color: "bg-[#FF4500]" },
  { position: 35, name: "Short Line", type: "property", color: "bg-gray-700" },
  { position: 36, name: "Chance", type: "chance" },
  { position: 37, name: "Park Place", type: "property", color: "bg-[#00008B]" },
  { position: 38, name: "Luxury Tax", type: "tax" },
  { position: 39, name: "Boardwalk", type: "property", color: "bg-[#00008B]" },
];

/** Map track position index to grid (row, col) on an 11×11 grid. Origin top-left. */
function getTrackCell(position: number): { row: number; col: number } {
  if (position <= 9) return { row: GRID_SIZE - 1, col: position }; // bottom: GO → right
  if (position === 10) return { row: GRID_SIZE - 1, col: GRID_SIZE - 1 }; // corner
  if (position <= 19) return { row: 19 - position, col: GRID_SIZE - 1 }; // right: up
  if (position <= 29) return { row: 0, col: 30 - position }; // top: 20→(0,10), 29→(0,1)
  if (position === 30) return { row: 0, col: 0 }; // corner
  return { row: position - 30, col: 0 }; // left: 31→(1,0), 39→(9,0)
}

const trackByCell = new Map<string, number>();
TRACK_CONFIG.forEach((s) => {
  const { row, col } = getTrackCell(s.position);
  trackByCell.set(`${row},${col}`, s.position);
});

function getTrackAt(row: number, col: number): TrackSquareConfig | undefined {
  const pos = trackByCell.get(`${row},${col}`);
  return pos !== undefined ? TRACK_CONFIG[pos] : undefined;
}

function isCenterArea(row: number, col: number): boolean {
  return row >= CENTER_START && row < CENTER_END && col >= CENTER_START && col < CENTER_END;
}

function isCenterCell(row: number, col: number): boolean {
  return row >= 1 && row < GRID_SIZE - 1 && col >= 1 && col < GRID_SIZE - 1;
}

export default function GameBoard(): React.JSX.Element {
  return (
    <div
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
            const isCenterAnchor = row === CENTER_START && col === CENTER_START;
            if (!isCenterAnchor) return <div key={i} className="col-span-1 row-span-1" aria-hidden />;
            return (
              <div
                key={i}
                className="flex items-center justify-center p-1 bg-[var(--tycoon-bg)]"
                style={{
                  gridColumn: `${col + 1} / ${col + 1 + (CENTER_END - CENTER_START)}`,
                  gridRow: `${row + 1} / ${row + 1 + (CENTER_END - CENTER_START)}`,
                }}
              >
                <CenterArea />
              </div>
            );
          }

          const track = getTrackAt(row, col);
          if (track) {
            return (
              <div key={i} className="flex items-center justify-center p-0.5 sm:p-1 min-w-0 min-h-0 overflow-hidden">
                <BoardSquare
                  name={track.name}
                  position={track.position}
                  type={track.type}
                  color={track.color}
                />
              </div>
            );
          }

          if (isCenterCell(row, col)) {
            return <div key={i} className="bg-[var(--tycoon-card-bg)]/30 border border-[var(--tycoon-border)]/30 rounded" />;
          }

          return <div key={i} />;
        })}
      </div>
    </div>
  );
}
