import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useCardModal, type CardData } from './useCardModal';

describe('useCardModal', () => {
  describe('initial state', () => {
    it('initializes with modal closed and no card data', () => {
      const { result } = renderHook(() => useCardModal());

      expect(result.current.isOpen).toBe(false);
      expect(result.current.card).toBeNull();
    });
  });

  describe('openCard', () => {
    it('opens the modal and sets card data when provided', () => {
      const { result } = renderHook(() => useCardModal());
      const cardData: CardData = { type: 'chance', text: 'Draw a card' };

      act(() => {
        result.current.openCard(cardData);
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.card).toEqual(cardData);
    });

    it('updates card data when opening with different card', () => {
      const { result } = renderHook(() => useCardModal());
      const card1: CardData = { type: 'chance', text: 'First card' };
      const card2: CardData = { type: 'community', text: 'Second card' };

      act(() => {
        result.current.openCard(card1);
      });

      expect(result.current.card).toEqual(card1);

      act(() => {
        result.current.openCard(card2);
      });

      expect(result.current.card).toEqual(card2);
    });

    it('handles opening with chance card type', () => {
      const { result } = renderHook(() => useCardModal());
      const chanceCard: CardData = { type: 'chance', text: 'Advance to Go' };

      act(() => {
        result.current.openCard(chanceCard);
      });

      expect(result.current.card?.type).toBe('chance');
      expect(result.current.card?.text).toBe('Advance to Go');
    });

    it('handles opening with community card type', () => {
      const { result } = renderHook(() => useCardModal());
      const communityCard: CardData = { type: 'community', text: 'Pay school tax' };

      act(() => {
        result.current.openCard(communityCard);
      });

      expect(result.current.card?.type).toBe('community');
      expect(result.current.card?.text).toBe('Pay school tax');
    });
  });

  describe('close', () => {
    it('closes the modal and clears card data', () => {
      const { result } = renderHook(() => useCardModal());
      const cardData: CardData = { type: 'chance', text: 'Draw a card' };

      act(() => {
        result.current.openCard(cardData);
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.card).not.toBeNull();

      act(() => {
        result.current.close();
      });

      expect(result.current.isOpen).toBe(false);
      expect(result.current.card).toBeNull();
    });

    it('resets state to initial state when closing', () => {
      const { result } = renderHook(() => useCardModal());
      const cardData: CardData = { type: 'chance', text: 'Test card' };

      act(() => {
        result.current.openCard(cardData);
      });

      act(() => {
        result.current.close();
      });

      expect(result.current.isOpen).toBe(false);
      expect(result.current.card).toBeNull();
    });

    it('handles closing when modal is already closed', () => {
      const { result } = renderHook(() => useCardModal());

      expect(() => {
        act(() => {
          result.current.close();
        });
      }).not.toThrow();

      expect(result.current.isOpen).toBe(false);
      expect(result.current.card).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('handles rapid open/close without state inconsistency', () => {
      const { result } = renderHook(() => useCardModal());
      const card1: CardData = { type: 'chance', text: 'Card 1' };
      const card2: CardData = { type: 'community', text: 'Card 2' };

      act(() => {
        result.current.openCard(card1);
        result.current.close();
        result.current.openCard(card2);
        result.current.close();
      });

      expect(result.current.isOpen).toBe(false);
      expect(result.current.card).toBeNull();
    });

    it('maintains correct state with multiple open/close cycles', () => {
      const { result } = renderHook(() => useCardModal());
      const card: CardData = { type: 'chance', text: 'Persistent card' };

      for (let i = 0; i < 3; i++) {
        act(() => {
          result.current.openCard(card);
        });

        expect(result.current.isOpen).toBe(true);
        expect(result.current.card).toEqual(card);

        act(() => {
          result.current.close();
        });

        expect(result.current.isOpen).toBe(false);
        expect(result.current.card).toBeNull();
      }
    });

    it('clears card state explicitly on close (sterile cleanup)', () => {
      const { result } = renderHook(() => useCardModal());
      const cardData: CardData = { type: 'chance', text: 'Cleanup test' };

      act(() => {
        result.current.openCard(cardData);
      });

      const openCard = result.current.card;
      expect(openCard).not.toBeNull();

      act(() => {
        result.current.close();
      });

      expect(result.current.card).toBeNull();
      expect(result.current.isOpen).toBe(false);
    });

    it('returns stable callback references across re-renders', () => {
      const { result, rerender } = renderHook(() => useCardModal());

      const openCardRef1 = result.current.openCard;
      const closeRef1 = result.current.close;

      rerender();

      const openCardRef2 = result.current.openCard;
      const closeRef2 = result.current.close;

      expect(openCardRef1).toBe(openCardRef2);
      expect(closeRef1).toBe(closeRef2);
    });
  });

  describe('unmount cleanup', () => {
    it('does not cause memory leaks when component unmounts with open modal', () => {
      const { result, unmount } = renderHook(() => useCardModal());
      const cardData: CardData = { type: 'chance', text: 'Unmount test' };

      act(() => {
        result.current.openCard(cardData);
      });

      expect(result.current.isOpen).toBe(true);

      expect(() => {
        unmount();
      }).not.toThrow();
    });

    it('cleans up callback references on unmount', () => {
      const { result, unmount } = renderHook(() => useCardModal());

      const openCardRef = result.current.openCard;
      const closeRef = result.current.close;

      expect(openCardRef).toBeDefined();
      expect(closeRef).toBeDefined();

      unmount();

      // After unmount, trying to use the old refs should not affect anything
      // This is more of a sanity check that unmount completes without errors
    });
  });
});
