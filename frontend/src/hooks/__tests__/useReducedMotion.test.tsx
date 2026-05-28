import { renderHook, act } from '@testing-library/react';
import { useReducedMotion } from '../useReducedMotion';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

type MediaQueryCallback = (event: MediaQueryListEvent) => void;

function makeMockMql(matches: boolean) {
  const listeners: MediaQueryCallback[] = [];
  return {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: vi.fn((_: string, cb: MediaQueryCallback) => { listeners.push(cb); }),
    removeEventListener: vi.fn((_: string, cb: MediaQueryCallback) => {
      const idx = listeners.indexOf(cb);
      if (idx !== -1) listeners.splice(idx, 1);
    }),
    dispatchEvent: vi.fn(),
    /** Test helper — fire a change event to all registered listeners. */
    _fire(nextMatches: boolean) {
      listeners.forEach((cb) => cb({ matches: nextMatches } as MediaQueryListEvent));
    },
  };
}

describe('useReducedMotion', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', { value: originalMatchMedia, writable: true });
    vi.clearAllMocks();
  });

  it('returns false when prefers-reduced-motion is not set', () => {
    const mql = makeMockMql(false);
    window.matchMedia = vi.fn().mockReturnValue(mql);

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('returns true when prefers-reduced-motion: reduce is active', () => {
    const mql = makeMockMql(true);
    window.matchMedia = vi.fn().mockReturnValue(mql);

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it('updates when the media query changes to reduced', () => {
    const mql = makeMockMql(false);
    window.matchMedia = vi.fn().mockReturnValue(mql);

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => { mql._fire(true); });
    expect(result.current).toBe(true);
  });

  it('updates when the media query changes back to no preference', () => {
    const mql = makeMockMql(true);
    window.matchMedia = vi.fn().mockReturnValue(mql);

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);

    act(() => { mql._fire(false); });
    expect(result.current).toBe(false);
  });

  it('removes the event listener on unmount', () => {
    const mql = makeMockMql(false);
    window.matchMedia = vi.fn().mockReturnValue(mql);

    const { unmount } = renderHook(() => useReducedMotion());
    unmount();

    expect(mql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('uses the provided defaultValue when matchMedia is unavailable', () => {
    // Simulate SSR / no matchMedia
    Object.defineProperty(window, 'matchMedia', { value: undefined, writable: true });

    const { result } = renderHook(() => useReducedMotion(true));
    expect(result.current).toBe(true);
  });

  it('defaults to false when matchMedia is unavailable and no defaultValue given', () => {
    Object.defineProperty(window, 'matchMedia', { value: undefined, writable: true });

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });
});
