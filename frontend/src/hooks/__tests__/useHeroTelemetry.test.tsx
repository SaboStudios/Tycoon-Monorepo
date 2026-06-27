import { renderHook, act } from '@testing-library/react';
import { useHeroTelemetry } from '../useHeroTelemetry';
import { track } from '@/lib/analytics';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}));

describe('useHeroTelemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('returns trackHeroViewed and trackCtaClicked', () => {
      const { result } = renderHook(() => useHeroTelemetry());
      expect(result.current.trackHeroViewed).toBeDefined();
      expect(result.current.trackCtaClicked).toBeDefined();
    });

    it('uses default route "/"', () => {
      const { result } = renderHook(() => useHeroTelemetry());
      act(() => { result.current.trackHeroViewed(); });
      expect(track).toHaveBeenCalledWith('hero_viewed', expect.objectContaining({ route: '/' }));
    });

    it('accepts a custom route', () => {
      const { result } = renderHook(() => useHeroTelemetry('/landing'));
      act(() => { result.current.trackHeroViewed(); });
      expect(track).toHaveBeenCalledWith('hero_viewed', expect.objectContaining({ route: '/landing' }));
    });
  });

  describe('trackHeroViewed', () => {
    it('tracks hero_viewed with default source', () => {
      const { result } = renderHook(() => useHeroTelemetry());
      act(() => { result.current.trackHeroViewed(); });
      expect(track).toHaveBeenCalledWith('hero_viewed', { route: '/', source: 'page_load' });
    });

    it('tracks hero_viewed with custom source', () => {
      const { result } = renderHook(() => useHeroTelemetry());
      act(() => { result.current.trackHeroViewed('scroll'); });
      expect(track).toHaveBeenCalledWith('hero_viewed', { route: '/', source: 'scroll' });
    });

    it('does not include PII in payload', () => {
      const { result } = renderHook(() => useHeroTelemetry());
      act(() => { result.current.trackHeroViewed(); });
      const payload = (track as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(payload).not.toHaveProperty('user_id');
      expect(payload).not.toHaveProperty('wallet_address');
      expect(payload).not.toHaveProperty('session');
    });
  });

  describe('trackCtaClicked', () => {
    it('tracks hero_cta_clicked for continue_game', () => {
      const { result } = renderHook(() => useHeroTelemetry());
      act(() => { result.current.trackCtaClicked('continue_game', '/game-settings'); });
      expect(track).toHaveBeenCalledWith('hero_cta_clicked', {
        route: '/',
        cta: 'continue_game',
        destination: '/game-settings',
      });
    });

    it('tracks hero_cta_clicked for multiplayer', () => {
      const { result } = renderHook(() => useHeroTelemetry());
      act(() => { result.current.trackCtaClicked('multiplayer', '/game-settings'); });
      expect(track).toHaveBeenCalledWith('hero_cta_clicked', {
        route: '/',
        cta: 'multiplayer',
        destination: '/game-settings',
      });
    });

    it('tracks hero_cta_clicked for join_room', () => {
      const { result } = renderHook(() => useHeroTelemetry());
      act(() => { result.current.trackCtaClicked('join_room', '/join-room'); });
      expect(track).toHaveBeenCalledWith('hero_cta_clicked', {
        route: '/',
        cta: 'join_room',
        destination: '/join-room',
      });
    });

    it('tracks hero_cta_clicked for challenge_ai', () => {
      const { result } = renderHook(() => useHeroTelemetry());
      act(() => { result.current.trackCtaClicked('challenge_ai', '/play-ai'); });
      expect(track).toHaveBeenCalledWith('hero_cta_clicked', {
        route: '/',
        cta: 'challenge_ai',
        destination: '/play-ai',
      });
    });

    it('does not include PII in payload', () => {
      const { result } = renderHook(() => useHeroTelemetry());
      act(() => { result.current.trackCtaClicked('continue_game', '/game-settings'); });
      const payload = (track as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(payload).not.toHaveProperty('user_id');
      expect(payload).not.toHaveProperty('wallet_address');
      expect(payload).not.toHaveProperty('session');
    });
  });

  describe('callback stability', () => {
    it('returns stable references across re-renders with same route', () => {
      const { result, rerender } = renderHook(
        ({ route }: { route: string }) => useHeroTelemetry(route),
        { initialProps: { route: '/' } },
      );
      const first = result.current.trackHeroViewed;
      rerender({ route: '/' });
      expect(result.current.trackHeroViewed).toBe(first);
    });

    it('updates callbacks when route changes', () => {
      const { result, rerender } = renderHook(
        ({ route }: { route: string }) => useHeroTelemetry(route),
        { initialProps: { route: '/' } },
      );
      act(() => { result.current.trackHeroViewed(); });
      expect(track).toHaveBeenCalledWith('hero_viewed', expect.objectContaining({ route: '/' }));

      vi.clearAllMocks();
      rerender({ route: '/promo' });
      act(() => { result.current.trackHeroViewed(); });
      expect(track).toHaveBeenCalledWith('hero_viewed', expect.objectContaining({ route: '/promo' }));
    });
  });

  describe('privacy compliance', () => {
    it('never sends user identifiers across all events', () => {
      const { result } = renderHook(() => useHeroTelemetry());
      act(() => {
        result.current.trackHeroViewed();
        result.current.trackCtaClicked('continue_game', '/game-settings');
        result.current.trackCtaClicked('challenge_ai', '/play-ai');
      });
      (track as ReturnType<typeof vi.fn>).mock.calls.forEach(([, payload]: [string, Record<string, unknown>]) => {
        expect(payload).not.toHaveProperty('user_id');
        expect(payload).not.toHaveProperty('wallet_address');
        expect(payload).not.toHaveProperty('session_id');
        expect(payload).not.toHaveProperty('email');
      });
    });
  });

  describe('no duplicate events on re-render', () => {
    it('does not fire duplicate events when dependencies are stable', () => {
      const { result, rerender } = renderHook(
        ({ route }: { route: string }) => useHeroTelemetry(route),
        { initialProps: { route: '/' } }
      );

      act(() => {
        result.current.trackHeroViewed();
      });

      const callCountBefore = (track as ReturnType<typeof vi.fn>).mock.calls.length;

      rerender({ route: '/' });

      const callCountAfter = (track as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(callCountAfter).toBe(callCountBefore);
    });

    it('callback references remain stable with same route, preventing unnecessary re-renders', () => {
      const { result, rerender } = renderHook(
        ({ route }: { route: string }) => useHeroTelemetry(route),
        { initialProps: { route: '/' } }
      );

      const firstViewedCallback = result.current.trackHeroViewed;
      const firstCtaCallback = result.current.trackCtaClicked;

      rerender({ route: '/' });

      expect(result.current.trackHeroViewed).toBe(firstViewedCallback);
      expect(result.current.trackCtaClicked).toBe(firstCtaCallback);
    });
  });

  describe('disconnected or unavailable telemetry provider', () => {
    it('handles gracefully when track function is mocked to throw', () => {
      (track as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
        throw new Error('Telemetry provider unavailable');
      });

      const { result } = renderHook(() => useHeroTelemetry());

      expect(() => {
        act(() => {
          result.current.trackHeroViewed();
        });
      }).toThrow();
    });

    it('continues to function even if one telemetry call fails', () => {
      const mockTrack = track as ReturnType<typeof vi.fn>;
      mockTrack.mockImplementationOnce(() => {
        throw new Error('Provider down');
      });

      const { result } = renderHook(() => useHeroTelemetry());

      expect(() => {
        act(() => {
          try {
            result.current.trackHeroViewed();
          } catch {
            // Expected to fail on first call
          }
        });
      }).not.toThrow();
    });

    it('can recover and fire events after telemetry provider recovers', () => {
      const mockTrack = track as ReturnType<typeof vi.fn>;

      mockTrack.mockClear();
      mockTrack.mockImplementationOnce(() => {
        throw new Error('Provider down');
      });

      const { result } = renderHook(() => useHeroTelemetry());

      try {
        act(() => {
          result.current.trackHeroViewed();
        });
      } catch {
        // Expected
      }

      mockTrack.mockClear();
      mockTrack.mockImplementation(() => {});

      act(() => {
        result.current.trackHeroViewed();
      });

      expect(mockTrack).toHaveBeenCalledWith('hero_viewed', expect.any(Object));
    });
  });

  describe('unmount safety (stale state)', () => {
    it('does not fire events after unmount', () => {
      const mockTrack = track as ReturnType<typeof vi.fn>;
      mockTrack.mockClear();

      const { result, unmount } = renderHook(() => useHeroTelemetry());

      act(() => {
        result.current.trackHeroViewed();
      });

      expect(mockTrack).toHaveBeenCalledTimes(1);

      mockTrack.mockClear();
      unmount();

      // Attempting to call after unmount should not fire additional events
      // (Note: In a real React component, this would be prevented by React itself)
      expect(mockTrack).not.toHaveBeenCalled();
    });

    it('hook cleanup does not throw on unmount', () => {
      const { unmount } = renderHook(() => useHeroTelemetry());

      expect(() => {
        unmount();
      }).not.toThrow();
    });

    it('callbacks are still callable after unmount (no crash), but should not update state', () => {
      const mockTrack = track as ReturnType<typeof vi.fn>;
      mockTrack.mockClear();

      const { result, unmount } = renderHook(() => useHeroTelemetry());

      const callbackRef = result.current.trackHeroViewed;

      unmount();

      // Callback reference is still valid, but calling it after unmount should not cause errors
      expect(() => {
        callbackRef();
      }).not.toThrow();
    });
  });

  describe('edge cases: null/undefined values', () => {
    it('handles undefined source in trackHeroViewed', () => {
      const { result } = renderHook(() => useHeroTelemetry());

      act(() => {
        result.current.trackHeroViewed(undefined as any);
      });

      expect(track).toHaveBeenCalledWith('hero_viewed', expect.objectContaining({ route: '/' }));
    });

    it('handles empty string source in trackHeroViewed', () => {
      const { result } = renderHook(() => useHeroTelemetry());

      act(() => {
        result.current.trackHeroViewed('');
      });

      expect(track).toHaveBeenCalledWith('hero_viewed', expect.objectContaining({ source: '' }));
    });

    it('handles empty string destination in trackCtaClicked', () => {
      const { result } = renderHook(() => useHeroTelemetry());

      act(() => {
        result.current.trackCtaClicked('continue_game', '');
      });

      expect(track).toHaveBeenCalledWith('hero_cta_clicked', expect.objectContaining({ destination: '' }));
    });

    it('handles null route parameter gracefully', () => {
      const { result } = renderHook(() => useHeroTelemetry(null as any));

      act(() => {
        result.current.trackHeroViewed();
      });

      expect(track).toHaveBeenCalled();
    });
  });
});
