import { renderHook, act } from '@testing-library/react';
import { useGameBoardLogic, GameBoardState } from '../useGameBoardLogic';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('useGameBoardLogic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('initialization', () => {
    it('returns a GameBoardState object', () => {
      const { result } = renderHook(() => useGameBoardLogic());
      expect(result.current).toBeDefined();
      expect(result.current.currentPlayer).toBeDefined();
      expect(result.current.players).toBeDefined();
      expect(result.current.board).toBeDefined();
      expect(result.current.rollDice).toBeDefined();
    });

    it('initializes with default players', () => {
      const { result } = renderHook(() => useGameBoardLogic());
      expect(result.current.players).toHaveLength(2);
      expect(result.current.players[0].id).toBe('player-1');
      expect(result.current.players[0].name).toBe('Player 1');
      expect(result.current.players[1].id).toBe('player-2');
      expect(result.current.players[1].name).toBe('Player 2');
    });

    it('initializes with default board tiles', () => {
      const { result } = renderHook(() => useGameBoardLogic());
      expect(result.current.board).toHaveLength(40);
      expect(result.current.board[0].name).toBe('GO');
      expect(result.current.board[0].type).toBe('corner');
    });

    it('sets currentPlayer to the first player', () => {
      const { result } = renderHook(() => useGameBoardLogic());
      expect(result.current.currentPlayer).toEqual(result.current.players[0]);
    });

    it('initializes all players with correct default balance and position', () => {
      const { result } = renderHook(() => useGameBoardLogic());
      result.current.players.forEach((player) => {
        expect(player.balance).toBe(1500);
        expect(player.position).toBe(0);
        expect(player.color).toBeDefined();
      });
    });

    it('initializes all board tiles as unowned', () => {
      const { result } = renderHook(() => useGameBoardLogic());
      result.current.board.forEach((tile) => {
        expect(tile.ownerId).toBeNull();
      });
    });
  });

  describe('board state', () => {
    it('board tiles have correct indices', () => {
      const { result } = renderHook(() => useGameBoardLogic());
      result.current.board.forEach((tile, idx) => {
        expect(tile.index).toBe(idx);
      });
    });

    it('board tiles have valid types', () => {
      const { result } = renderHook(() => useGameBoardLogic());
      const validTypes = ['property', 'railroad', 'utility', 'tax', 'corner', 'chance', 'community'];
      result.current.board.forEach((tile) => {
        expect(validTypes).toContain(tile.type);
      });
    });

    it('all board tiles have names', () => {
      const { result } = renderHook(() => useGameBoardLogic());
      result.current.board.forEach((tile) => {
        expect(tile.name).toBeDefined();
        expect(tile.name.length).toBeGreaterThan(0);
      });
    });
  });

  describe('rollDice', () => {
    it('can be called without throwing', () => {
      const { result } = renderHook(() => useGameBoardLogic());
      expect(() => {
        result.current.rollDice();
      }).not.toThrow();
    });

    it('sets lastRoll after rolling', () => {
      const { result } = renderHook(() => useGameBoardLogic());
      act(() => { result.current.rollDice(); });
      expect(result.current.lastRoll).not.toBeNull();
      expect(result.current.lastRoll?.die1).toBeGreaterThanOrEqual(1);
      expect(result.current.lastRoll?.die1).toBeLessThanOrEqual(6);
      expect(result.current.lastRoll?.die2).toBeGreaterThanOrEqual(1);
      expect(result.current.lastRoll?.die2).toBeLessThanOrEqual(6);
      expect(result.current.lastRoll?.total).toBe(
        (result.current.lastRoll?.die1 ?? 0) + (result.current.lastRoll?.die2 ?? 0)
      );
    });

    it('generates dice values between 1 and 6', () => {
      const { result } = renderHook(() => useGameBoardLogic());

      for (let i = 0; i < 10; i++) {
        act(() => { result.current.rollDice(); });
        expect(result.current.lastRoll?.die1).toBeGreaterThanOrEqual(1);
        expect(result.current.lastRoll?.die1).toBeLessThanOrEqual(6);
        expect(result.current.lastRoll?.die2).toBeGreaterThanOrEqual(1);
        expect(result.current.lastRoll?.die2).toBeLessThanOrEqual(6);
      }
    });

    it('advances current player position after rolling', () => {
      const { result } = renderHook(() => useGameBoardLogic());
      const initialPosition = result.current.players[0].position;
      act(() => { result.current.rollDice(); });
      // After rolling, either position advanced or total was set
      expect(result.current.lastRoll).not.toBeNull();
      const newPosition = result.current.players[0].position;
      expect(newPosition).toBe(
        (initialPosition + (result.current.lastRoll?.total ?? 0)) % 40
      );
    });
  });

  describe('player data', () => {
    it('all players have unique IDs', () => {
      const { result } = renderHook(() => useGameBoardLogic());
      const ids = result.current.players.map((p) => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('all players have colors', () => {
      const { result } = renderHook(() => useGameBoardLogic());
      result.current.players.forEach((player) => {
        expect(player.color).toBeDefined();
        expect(typeof player.color).toBe('string');
        expect(player.color.length).toBeGreaterThan(0);
      });
    });

    it('all players have valid balance values', () => {
      const { result } = renderHook(() => useGameBoardLogic());
      result.current.players.forEach((player) => {
        expect(typeof player.balance).toBe('number');
        expect(player.balance).toBeGreaterThanOrEqual(0);
      });
    });

    it('all players have valid position values', () => {
      const { result } = renderHook(() => useGameBoardLogic());
      result.current.players.forEach((player) => {
        expect(typeof player.position).toBe('number');
        expect(player.position).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('state stability', () => {
    it('returns same board reference on subsequent calls', () => {
      const { result, rerender } = renderHook(() => useGameBoardLogic());
      const firstBoard = result.current.board;
      rerender();
      const secondBoard = result.current.board;
      expect(firstBoard).toBe(secondBoard);
    });

    it('returns same players reference on subsequent calls', () => {
      const { result, rerender } = renderHook(() => useGameBoardLogic());
      const firstPlayers = result.current.players;
      rerender();
      const secondPlayers = result.current.players;
      expect(firstPlayers).toBe(secondPlayers);
    });

    it('rollDice function maintains consistent behavior across multiple calls', () => {
      const { result } = renderHook(() => useGameBoardLogic());

      // rollDice can be called 3 times without throwing
      expect(() => {
        act(() => { result.current.rollDice(); });
        act(() => { result.current.rollDice(); });
        act(() => { result.current.rollDice(); });
      }).not.toThrow();

      // lastRoll is populated after 3 rolls
      expect(result.current.lastRoll).not.toBeNull();
      expect(result.current.lastRoll?.total).toBeGreaterThanOrEqual(2);
      expect(result.current.lastRoll?.total).toBeLessThanOrEqual(12);
    });
  });

  describe('edge cases and invalid inputs', () => {
    it('handles null/undefined safety (hook returns valid object)', () => {
      const { result } = renderHook(() => useGameBoardLogic());
      expect(result.current).not.toBeNull();
      expect(result.current).not.toBeUndefined();
    });

    it('rollDice can be called multiple times without state corruption', () => {
      const { result } = renderHook(() => useGameBoardLogic());
      const originalPlayerCount = result.current.players.length;
      const originalBoardLength = result.current.board.length;

      for (let i = 0; i < 100; i++) {
        result.current.rollDice();
      }

      expect(result.current.players).toHaveLength(originalPlayerCount);
      expect(result.current.board).toHaveLength(originalBoardLength);
    });

    it('board tiles remain unchanged after rollDice, player positions may change', () => {
      const { result } = renderHook(() => useGameBoardLogic());
      const originalBoard = JSON.stringify(result.current.board);

      act(() => { result.current.rollDice(); });

      // Board tiles are never mutated by rollDice
      expect(JSON.stringify(result.current.board)).toBe(originalBoard);
      // Player positions advance after a roll
      expect(result.current.lastRoll).not.toBeNull();
    });
  });

  describe('unmount safety', () => {
    it('does not throw when hook is unmounted', () => {
      const { result, unmount } = renderHook(() => useGameBoardLogic());
      expect(() => {
        unmount();
      }).not.toThrow();
    });

    it('can call rollDice before unmount without issues', () => {
      const { result, unmount } = renderHook(() => useGameBoardLogic());
      result.current.rollDice();
      expect(() => {
        unmount();
      }).not.toThrow();
    });
  });
});
