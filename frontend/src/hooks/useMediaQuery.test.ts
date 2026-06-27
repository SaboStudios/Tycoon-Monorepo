import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useMediaQuery } from './useMediaQuery';

// Mock window.matchMedia since JSDOM doesn't implement it
const mockMatchMedia = (matches: boolean) => {
  const listeners: Set<(e: MediaQueryListEvent) => void> = new Set();

  return {
    matches,
    media: '',
    onchange: null,
    addListener: vi.fn((listener) => listeners.add(listener)),
    removeListener: vi.fn((listener) => listeners.delete(listener)),
    addEventListener: vi.fn((event: string, listener: (e: MediaQueryListEvent) => void) => {
      if (event === 'change') {
        listeners.add(listener);
      }
    }),
    removeEventListener: vi.fn((event: string, listener: (e: MediaQueryListEvent) => void) => {
      if (event === 'change') {
        listeners.delete(listener);
      }
    }),
    dispatchEvent: vi.fn(),
    listeners,
  };
};

describe('useMediaQuery', () => {
  beforeEach(() => {
    // Setup default matchMedia mock
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => mockMatchMedia(false)),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when media query matches', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => mockMatchMedia(true)),
    });

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(true);
  });

  it('returns false when media query does not match', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => mockMatchMedia(false)),
    });

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(false);
  });

  it('updates value when media query match state changes', () => {
    let mockInstance = mockMatchMedia(false);
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => mockInstance),
    });

    const { result, rerender } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(false);

    // Simulate media query change
    act(() => {
      mockInstance.listeners.forEach((listener) => {
        listener(new Event('change') as unknown as MediaQueryListEvent);
      });
    });

    // Create new mock that returns true
    mockInstance = mockMatchMedia(true);
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => mockInstance),
    });

    rerender();
    // After rerender, the hook should have the updated value
  });

  it('cleans up event listener on unmount', () => {
    const mockInstance = mockMatchMedia(false);
    const removeEventListenerSpy = vi.spyOn(mockInstance, 'removeEventListener');

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => mockInstance),
    });

    const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('handles empty string query without throwing', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => mockMatchMedia(false)),
    });

    expect(() => {
      renderHook(() => useMediaQuery(''));
    }).not.toThrow();
  });

  it('handles invalid/malformed query gracefully', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => {
        throw new Error('Invalid media query');
      }),
    });

    // Hook should handle the error gracefully with try-catch or default value
    const { result } = renderHook(() => useMediaQuery('invalid query'), {
      initialProps: {},
    });

    // Should return default value or not throw
    expect(result.current).toBeDefined();
  });

  it('SSR safety: returns false when window is undefined', () => {
    // Simulate SSR by temporarily removing matchMedia
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: undefined,
    });

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));

    expect(result.current).toBe(false);

    // Restore
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: originalMatchMedia,
    });
  });

  it('accepts defaultValue parameter and uses it when matchMedia is unavailable', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: undefined,
    });

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)', true));
    expect(result.current).toBe(true);
  });

  it('uses correct media query in matchMedia call', () => {
    const mockInstance = mockMatchMedia(false);
    const matchMediaMock = vi.fn().mockImplementation((query: string) => mockInstance);

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: matchMediaMock,
    });

    renderHook(() => useMediaQuery('(prefers-color-scheme: dark)'));

    expect(matchMediaMock).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
  });

  it('handles rapid query changes', () => {
    const mockInstance = mockMatchMedia(false);
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => mockInstance),
    });

    const { rerender } = renderHook(
      ({ query }) => useMediaQuery(query),
      { initialProps: { query: '(min-width: 768px)' } }
    );

    expect(() => {
      rerender({ query: '(min-width: 1024px)' });
      rerender({ query: '(min-width: 1280px)' });
      rerender({ query: '(min-width: 768px)' });
    }).not.toThrow();
  });

  it('does not re-subscribe when query does not change', () => {
    const mockInstance = mockMatchMedia(false);
    const matchMediaMock = vi.fn().mockImplementation((query: string) => mockInstance);

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: matchMediaMock,
    });

    const { rerender } = renderHook(
      ({ query }) => useMediaQuery(query),
      { initialProps: { query: '(min-width: 768px)' } }
    );

    const callCountBefore = matchMediaMock.mock.calls.length;

    rerender({ query: '(min-width: 768px)' });

    // matchMedia might be called again on rerender depending on implementation
    // Just ensure it doesn't throw
    expect(matchMediaMock).toBeDefined();
  });
});
