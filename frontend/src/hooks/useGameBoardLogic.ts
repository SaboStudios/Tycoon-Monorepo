/**
 * useGameBoardLogic.ts
 *
 * STUB — placeholder hook for Tycoon game board state and logic.
 *
 * Real implementation should:
 *  - Connect to a Stellar smart contract or backend WebSocket for live game state.
 *  - Derive `board` from on-chain property/tile data.
 *  - Implement `rollDice` to send a signed transaction, update player position,
 *    trigger rent collection, property purchase prompts, etc.
 *  - Manage turn order, bankruptcy checks, win conditions, and animations.
 *  - Sync `currentPlayer` with the authenticated wallet address.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Player {
  /** Unique player identifier (wallet address in production) */
  id: string;
  /** Display name */
  name: string;
  /** Current balance in XLM / in-game currency */
  balance: number;
  /** Index of the tile the player is currently on (0–39 for a standard board) */
  position: number;
  /** Avatar colour used in the UI */
  color: string;
}

export interface Tile {
  /** Tile index on the board (0-based) */
  index: number;
  /** Human-readable name shown on the board */
  name: string;
  /** Tile category that drives game logic */
  type:
    | "property"
    | "railroad"
    | "utility"
    | "tax"
    | "corner"
    | "chance"
    | "community";
  /** Owner player id, or null if unowned */
  ownerId: string | null;
}

export interface GameBoardState {
  /** The player whose turn it currently is */
  currentPlayer: Player;
  /** All players in the game (including the current player) */
  players: Player[];
  /** All tiles that make up the board */
  board: Tile[];
  /**
   * Trigger a dice roll for the current player.
   *
   * Real implementation:
   *  1. Generate or fetch two random dice values.
   *  2. Advance `currentPlayer.position` by the sum.
   *  3. Resolve the landed tile (rent, buy prompt, tax, etc.).
   *  4. Advance turn to the next player (unless doubles were rolled).
   */
  rollDice: () => void;
}

// ─── Placeholder data ─────────────────────────────────────────────────────────

const PLACEHOLDER_PLAYERS: Player[] = [
  {
    id: "player-1",
    name: "Player 1",
    balance: 1500,
    position: 0,
    color: "#00F0FF",
  },
  {
    id: "player-2",
    name: "Player 2",
    balance: 1500,
    position: 0,
    color: "#FF6B6B",
  },
];

/** Minimal 8-tile stub board — real board has 40 tiles. */
const PLACEHOLDER_BOARD: Tile[] = [
  { index: 0, name: "GO", type: "corner", ownerId: null },
  { index: 1, name: "Mediterranean Ave", type: "property", ownerId: null },
  { index: 2, name: "Community Chest", type: "community", ownerId: null },
  { index: 3, name: "Baltic Ave", type: "property", ownerId: null },
  { index: 4, name: "Income Tax", type: "tax", ownerId: null },
  { index: 5, name: "Reading Railroad", type: "railroad", ownerId: null },
  { index: 6, name: "Oriental Ave", type: "property", ownerId: null },
  { index: 7, name: "Chance", type: "chance", ownerId: null },
];

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useGameBoardLogic
 *
 * Returns a minimal, static snapshot of the game board state.
 * All values are placeholders — no real game logic is executed yet.
 *
 * @returns {GameBoardState}
 */
export function useGameBoardLogic(): GameBoardState {
  const players = PLACEHOLDER_PLAYERS;
  const currentPlayer = players[0];
  const board = PLACEHOLDER_BOARD;

  /**
   * Stub rollDice — logs dice values to the console.
   * Replace with real transaction logic in production.
   */
  const rollDice = (): void => {
    const die1 = Math.ceil(Math.random() * 6);
    const die2 = Math.ceil(Math.random() * 6);
    console.log(
      `[useGameBoardLogic] ${currentPlayer.name} rolled ${die1} + ${die2} = ${die1 + die2}`,
    );
    // TODO: advance player position, resolve tile, handle turn transition
  };

  return {
    currentPlayer,
    players,
    board,
    rollDice,
  };
}
