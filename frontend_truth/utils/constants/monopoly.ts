// src/constants/monopoly.ts
export const BOARD_SQUARES = 40;
export const JAIL_POSITION = 10;
export const ROLL_ANIMATION_MS = 1200;
export const MOVE_ANIMATION_MS_PER_SQUARE = 250;

export const TOKEN_POSITIONS: Record<number, { x: number; y: number }> = {
  0: { x: 91.5, y: 91.5 },
  1: { x: 81.5, y: 91.5 },
  2: { x: 71.5, y: 91.5 },
  3: { x: 61.5, y: 91.5 },
  4: { x: 51.5, y: 91.5 },
  5: { x: 41.5, y: 91.5 },
  6: { x: 31.5, y: 91.5 },
  7: { x: 21.5, y: 91.5 },
  8: { x: 11.5, y: 91.5 },
  9: { x: 1.5, y: 91.5 },
  10: { x: 1.5, y: 91.5 },
  11: { x: 1.5, y: 81.5 },
  12: { x: 1.5, y: 71.5 },
  13: { x: 1.5, y: 61.5 },
  14: { x: 1.5, y: 51.5 },
  15: { x: 1.5, y: 41.5 },
  16: { x: 1.5, y: 31.5 },
  17: { x: 1.5, y: 21.5 },
  18: { x: 1.5, y: 11.5 },
  19: { x: 1.5, y: 1.5 },
  20: { x: 1.5, y: 1.5 },
  21: { x: 11.5, y: 1.5 },
  22: { x: 21.5, y: 1.5 },
  23: { x: 31.5, y: 1.5 },
  24: { x: 41.5, y: 1.5 },
  25: { x: 51.5, y: 1.5 },
  26: { x: 61.5, y: 1.5 },
  27: { x: 71.5, y: 1.5 },
  28: { x: 81.5, y: 1.5 },
  29: { x: 91.5, y: 1.5 },
  30: { x: 91.5, y: 1.5 },
  31: { x: 91.5, y: 11.5 },
  32: { x: 91.5, y: 21.5 },
  33: { x: 91.5, y: 31.5 },
  34: { x: 91.5, y: 41.5 },
  35: { x: 91.5, y: 51.5 },
  36: { x: 91.5, y: 61.5 },
  37: { x: 91.5, y: 71.5 },
  38: { x: 91.5, y: 81.5 },
  39: { x: 91.5, y: 91.5 },
};

export const BUILD_PRIORITY = ["orange", "red", "yellow", "pink", "lightblue", "green", "brown", "darkblue"];

export const MONOPOLY_STATS = {
  colorGroups: {
    brown: [1, 3],
    lightblue: [6, 8, 9],
    pink: [11, 13, 14],
    orange: [16, 18, 19],
    red: [21, 23, 24],
    yellow: [26, 27, 29],
    green: [31, 32, 34],
    darkblue: [37, 39],
    railroad: [5, 15, 25, 35],
    utility: [12, 28],
  },
};