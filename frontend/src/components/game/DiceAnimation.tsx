"use client";

import React from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface DiceAnimationProps {
  value?: number;
  isRolling?: boolean;
}

const diceDots: Record<number, number[][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

export default function DiceAnimation({ value = 1, isRolling = false }: DiceAnimationProps) {
  const clampedValue = Math.max(1, Math.min(6, value));
  const dots = diceDots[clampedValue];
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      role="img"
      aria-label={isRolling ? "Rolling dice" : `Dice showing ${clampedValue}`}
      aria-live="polite"
      className="inline-flex items-center justify-center"
    >
      <div
        className={`relative w-16 h-16 bg-[var(--tycoon-card-bg)] border-2 border-[var(--tycoon-accent)] rounded-lg shadow-lg ${
          isRolling && !prefersReducedMotion ? "animate-roll" : ""
        }`}
        style={{
          perspective: "1000px",
        }}
      >
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-1 p-2">
          {Array.from({ length: 9 }, (_, i) => {
            const row = Math.floor(i / 3);
            const col = i % 3;
            const hasDot = dots.some(([r, c]) => r === row && c === col);
            return (
              <div
                key={i}
                className={`rounded-full transition-all ${
                  hasDot ? "bg-[var(--tycoon-accent)] scale-100" : "scale-0"
                }`}
              />
            );
          })}
        </div>
      </div>
      <style jsx>{`
        @keyframes roll {
          0%, 100% { transform: rotate(0deg) scale(1); }
          25% { transform: rotate(90deg) scale(1.1); }
          50% { transform: rotate(180deg) scale(1); }
          75% { transform: rotate(270deg) scale(1.1); }
        }
        
        .animate-roll {
          animation: roll 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-roll {
            animation: none;
            opacity: 0.7;
          }
        }
      `}</style>
    </div>
  );
}
