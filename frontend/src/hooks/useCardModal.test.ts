import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useCardModal } from './useCardModal';

describe('useCardModal', () => {
  it('returns a referentially stable object across a no-op re-render', () => {
    const { result, rerender } = renderHook(() => useCardModal());

    const first = result.current;
    rerender();

    expect(result.current).toBe(first);
  });

  it('returns a new object after openCard', () => {
    const { result } = renderHook(() => useCardModal());

    const before = result.current;
    act(() => {
      result.current.openCard({ id: 'card-1' });
    });

    expect(result.current).not.toBe(before);
    expect(result.current.isOpen).toBe(true);
    expect(result.current.card).toEqual({ id: 'card-1' });
  });

  it('returns a new object after close', () => {
    const { result } = renderHook(() => useCardModal());

    act(() => {
      result.current.openCard({ id: 'card-1' });
    });

    const opened = result.current;
    act(() => {
      result.current.close();
    });

    expect(result.current).not.toBe(opened);
    expect(result.current.isOpen).toBe(false);
    expect(result.current.card).toBeNull();
  });
});
