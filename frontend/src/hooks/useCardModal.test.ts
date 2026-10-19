import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useCardModal } from './useCardModal';

describe('useCardModal', () => {
  it('starts closed with no card', () => {
    const { result } = renderHook(() => useCardModal());

    expect(result.current.isOpen).toBe(false);
    expect(result.current.card).toBeNull();
  });

  it('openCard stores the exact CardData and opens the modal', () => {
    const { result } = renderHook(() => useCardModal());

    const chanceCard = { type: 'chance' as const, text: 'Advance to Go' };
    act(() => {
      result.current.openCard(chanceCard);
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.card).toEqual(chanceCard);
    expect(result.current.card).toEqual({ type: 'chance', text: 'Advance to Go' });
  });

  it('openCard stores the community discriminant', () => {
    const { result } = renderHook(() => useCardModal());

    const communityCard = { type: 'community' as const, text: 'Bank error in your favor' };
    act(() => {
      result.current.openCard(communityCard);
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.card).toEqual(communityCard);
  });

  it('close resets the card to null, not just isOpen', () => {
    const { result } = renderHook(() => useCardModal());

    act(() => {
      result.current.openCard({ type: 'chance', text: 'Advance to Go' });
    });

    act(() => {
      result.current.close();
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.card).toBeNull();
  });

  it('openCard replaces the previous card', () => {
    const { result } = renderHook(() => useCardModal());

    act(() => {
      result.current.openCard({ type: 'chance', text: 'Advance to Go' });
    });

    const secondCard = { type: 'community' as const, text: 'Bank error in your favor' };
    act(() => {
      result.current.openCard(secondCard);
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.card).toEqual(secondCard);
    expect(result.current.card).not.toEqual({ type: 'chance', text: 'Advance to Go' });
  });
});
