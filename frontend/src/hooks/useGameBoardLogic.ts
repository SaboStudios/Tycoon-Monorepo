/**
 * useGameBoardLogic.ts
 *
 * Local-first game board state for a standard 40-tile Tycoon board.
 *
 * Current scope (issue #1452):
 *  - 40 canonical tiles matching the backend properties module ids.
 *  - rollDice advances the current player's position locally.
 *  - Turn rotates after each roll (no doubles re-roll yet).
 *  - No console.log in production paths.
 *
 * Gateway / WebSocket integration is tracked in a follow-up issue once the
 * games WebSocket is available. Position mutations will then be replaced by
 * server-authoritative events.
 */

import { useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Player {
  /** Unique player identifier (wallet address in production) */
  id: string;
  /** Display name */
  name: string;
  /** Current balance in in-game currency */
  balance: number;
  /** Index of the tile the player is currently on (0–39) */
  position: number;
  /** Avatar colour used in the UI */
  color: string;
}

export interface Tile {
  /** Tile index on the board (0-based, 0–39) */
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
  /**
   * Backend property id from the properties module.
   * null for non-purchasable tiles (corners, tax, chance, community).
   */
  propertyId: number | null;
  /** Owner player id, or null if unowned */
  ownerId: string | null;
}

export interface GameBoardState {
  /** The player whose turn it currently is */
  currentPlayer: Player;
  /** All players in the game (including the current player) */
  players: Player[];
  /** All 40 tiles that make up the board */
  board: Tile[];
  /** Most recent dice roll result, null before the first roll */
  lastRoll: { die1: number; die2: number; total: number } | null;
  /**
   * Trigger a dice roll for the current player.
   * Advances the player's position and rotates the turn locally.
   * Will be replaced by a gateway mutation once the WebSocket is wired.
   */
  rollDice: () => void;
}

// ─── 40-tile board definition ────────────────────────────────────────────────
// propertyId values match the backend properties module ids (1-based, skipping
// non-purchasable tiles). Corners, taxes, chance and community cards have null.

const BOARD_40: Tile[] = [
  { index: 0,  name: "GO",                    type: "corner",    propertyId: null, ownerId: null },
  { index: 1,  name: "Mediterranean Ave",     type: "property",  propertyId: 1,    ownerId: null },
  { index: 2,  name: "Community Chest",       type: "community", propertyId: null, ownerId: null },
  { index: 3,  name: "Baltic Ave",            type: "property",  propertyId: 2,    ownerId: null },
  { index: 4,  name: "Income Tax",            type: "tax",       propertyId: null, ownerId: null },
  { index: 5,  name: "Reading Railroad",      type: "railroad",  propertyId: 3,    ownerId: null },
  { index: 6,  name: "Oriental Ave",          type: "property",  propertyId: 4,    ownerId: null },
  { index: 7,  name: "Chance",                type: "chance",    propertyId: null, ownerId: null },
  { index: 8,  name: "Vermont Ave",           type: "property",  propertyId: 5,    ownerId: null },
  { index: 9,  name: "Connecticut Ave",       type: "property",  propertyId: 6,    ownerId: null },
  { index: 10, name: "Jail / Just Visiting",  type: "corner",    propertyId: null, ownerId: null },
  { index: 11, name: "St. Charles Place",     type: "property",  propertyId: 7,    ownerId: null },
  { index: 12, name: "Electric Company",      type: "utility",   propertyId: 8,    ownerId: null },
  { index: 13, name: "States Ave",            type: "property",  propertyId: 9,    ownerId: null },
  { index: 14, name: "Virginia Ave",          type: "property",  propertyId: 10,   ownerId: null },
  { index: 15, name: "Pennsylvania Railroad", type: "railroad",  propertyId: 11,   ownerId: null },
  { index: 16, name: "St. James Place",       type: "property",  propertyId: 12,   ownerId: null },
  { index: 17, name: "Community Chest",       type: "community", propertyId: null, ownerId: null },
  { index: 18, name: "Tennessee Ave",         type: "property",  propertyId: 13,   ownerId: null },
  { index: 19, name: "New York Ave",          type: "property",  propertyId: 14,   ownerId: null },
  { index: 20, name: "Free Parking",          type: "corner",    propertyId: null, ownerId: null },
  { index: 21, name: "Kentucky Ave",          type: "property",  propertyId: 15,   ownerId: null },
  { index: 22, name: "Chance",                type: "chance",    propertyId: null, ownerId: null },
  { index: 23, name: "Indiana Ave",           type: "property",  propertyId: 16,   ownerId: null },
  { index: 24, name: "Illinois Ave",          type: "property",  propertyId: 17,   ownerId: null },
  { index: 25, name: "B&O Railroad",          type: "railroad",  propertyId: 18,   ownerId: null },
  { index: 26, name: "Atlantic Ave",          type: "property",  propertyId: 19,   ownerId: null },
  { index: 27, name: "Ventnor Ave",           type: "property",  propertyId: 20,   ownerId: null },
  { index: 28, name: "Water Works",           type: "utility",   propertyId: 21,   ownerId: null },
  { index: 29, name: "Marvin Gardens",        type: "property",  propertyId: 22,   ownerId: null },
  { index: 30, name: "Go To Jail",            type: "corner",    propertyId: null, ownerId: null },
  { index: 31, name: "Pacific Ave",           type: "property",  propertyId: 23,   ownerId: null },
  { index: 32, name: "North Carolina Ave",    type: "property",  propertyId: 24,   ownerId: null },
  { index: 33, name: "Community Chest",       type: "community", propertyId: null, ownerId: null },
  { index: 34, name: "Pennsylvania Ave",      type: "property",  propertyId: 25,   ownerId: null },
  { index: 35, name: "Short Line Railroad",   type: "railroad",  propertyId: 26,   ownerId: null },
  { index: 36, name: "Chance",                type: "chance",    propertyId: null, ownerId: null },
  { index: 37, name: "Park Place",            type: "property",  propertyId: 27,   ownerId: null },
  { index: 38, name: "Luxury Tax",            type: "tax",       propertyId: null, ownerId: null },
  { index: 39, name: "Boardwalk",             type: "property",  propertyId: 28,   ownerId: null },
];

// ─── Initial player state ─────────────────────────────────────────────────────

const INITIAL_PLAYERS: Player[] = [
  { id: "player-1", name: "Player 1", balance: 1500, position: 0, color: "#00F0FF" },
  { id: "player-2", name: "Player 2", balance: 1500, position: 0, color: "#FF6B6B" },
];

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useGameBoardLogic
 *
 * Returns local game board state with a functional rollDice.
 * Position wraps at 40 (passing GO). Turn advances after each roll.
 *
 * @returns {GameBoardState}
 */
export function useGameBoardLogic(): GameBoardState {
  const [players, setPlayers] = useState<Player[]>(INITIAL_PLAYERS);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [lastRoll, setLastRoll] = useState<GameBoardState["lastRoll"]>(null);

  const rollDice = useCallback((): void => {
    const buf = new Uint8Array(2);
    crypto.getRandomValues(buf);
    const die1 = (buf[0] % 6) + 1;
    const die2 = (buf[1] % 6) + 1;
    const total = die1 + die2;

    setLastRoll({ die1, die2, total });

    setPlayers((prev) => {
      const next = [...prev];
      const player = { ...next[currentTurnIndex] };
      player.position = (player.position + total) % 40;
      next[currentTurnIndex] = player;
      return next;
    });

    // Rotate to the next player's turn (doubles re-roll is a gateway concern)
    setCurrentTurnIndex((prev) => (prev + 1) % INITIAL_PLAYERS.length);
  }, [currentTurnIndex]);

  return {
    currentPlayer: players[currentTurnIndex],
    players,
    board: BOARD_40,
    lastRoll,
    rollDice,
  };
}
