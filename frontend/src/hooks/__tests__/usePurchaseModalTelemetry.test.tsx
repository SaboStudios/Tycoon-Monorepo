import { renderHook, act } from '@testing-library/react';
import { usePurchaseModalTelemetry } from '../usePurchaseModalTelemetry';
import { track } from '@/lib/analytics';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}));

describe('usePurchaseModalTelemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('returns all three tracking functions', () => {
      const { result } = renderHook(() => usePurchaseModalTelemetry());
      expect(result.current.trackModalViewed).toBeDefined();
      expect(result.current.trackModalCanceled).toBeDefined();
      expect(result.current.trackModalConfirmed).toBeDefined();
    });

    it('uses default route "/shop"', () => {
      const { result } = renderHook(() => usePurchaseModalTelemetry());
      act(() => { result.current.trackModalViewed({}); });
      expect(track).toHaveBeenCalledWith('purchase_modal_viewed', expect.objectContaining({ route: '/shop' }));
    });

    it('accepts a custom route', () => {
      const { result } = renderHook(() => usePurchaseModalTelemetry('/store'));
      act(() => { result.current.trackModalViewed({}); });
      expect(track).toHaveBeenCalledWith('purchase_modal_viewed', expect.objectContaining({ route: '/store' }));
    });
  });

  describe('trackModalViewed', () => {
    it('tracks purchase_modal_viewed with all fields', () => {
      const { result } = renderHook(() => usePurchaseModalTelemetry());
      act(() => {
        result.current.trackModalViewed({ itemName: 'Gold Pass', currency: 'USD', value: 9.99 });
      });
      expect(track).toHaveBeenCalledWith('purchase_modal_viewed', {
        route: '/shop',
        item_name: 'Gold Pass',
        currency: 'USD',
        value: 9.99,
      });
    });

    it('tracks with partial data — only itemName', () => {
      const { result } = renderHook(() => usePurchaseModalTelemetry());
      act(() => { result.current.trackModalViewed({ itemName: 'Silver Card' }); });
      expect(track).toHaveBeenCalledWith('purchase_modal_viewed', {
        route: '/shop',
        item_name: 'Silver Card',
        currency: undefined,
        value: undefined,
      });
    });

    it('tracks with empty data object', () => {
      const { result } = renderHook(() => usePurchaseModalTelemetry());
      act(() => { result.current.trackModalViewed({}); });
      expect(track).toHaveBeenCalledWith('purchase_modal_viewed', {
        route: '/shop',
        item_name: undefined,
        currency: undefined,
        value: undefined,
      });
    });

    it('accepts numeric string value', () => {
      const { result } = renderHook(() => usePurchaseModalTelemetry());
      act(() => { result.current.trackModalViewed({ value: '4.99' }); });
      expect(track).toHaveBeenCalledWith('purchase_modal_viewed', expect.objectContaining({ value: '4.99' }));
    });
  });

  describe('trackModalCanceled', () => {
    it('tracks purchase_modal_canceled with all fields', () => {
      const { result } = renderHook(() => usePurchaseModalTelemetry());
      act(() => {
        result.current.trackModalCanceled({ itemName: 'Rare Skin', currency: 'XLM', value: 100 });
      });
      expect(track).toHaveBeenCalledWith('purchase_modal_canceled', {
        route: '/shop',
        item_name: 'Rare Skin',
        currency: 'XLM',
        value: 100,
      });
    });

    it('tracks with empty data object', () => {
      const { result } = renderHook(() => usePurchaseModalTelemetry());
      act(() => { result.current.trackModalCanceled({}); });
      expect(track).toHaveBeenCalledWith('purchase_modal_canceled', expect.objectContaining({ route: '/shop' }));
    });
  });

  describe('trackModalConfirmed', () => {
    it('tracks purchase_modal_confirmed with all fields', () => {
      const { result } = renderHook(() => usePurchaseModalTelemetry());
      act(() => {
        result.current.trackModalConfirmed({ itemName: 'Epic Pack', currency: 'ETH', value: 0.05 });
      });
      expect(track).toHaveBeenCalledWith('purchase_modal_confirmed', {
        route: '/shop',
        item_name: 'Epic Pack',
        currency: 'ETH',
        value: 0.05,
      });
    });

    it('tracks with empty data object', () => {
      const { result } = renderHook(() => usePurchaseModalTelemetry());
      act(() => { result.current.trackModalConfirmed({}); });
      expect(track).toHaveBeenCalledWith('purchase_modal_confirmed', expect.objectContaining({ route: '/shop' }));
    });
  });

  describe('privacy compliance', () => {
    it('never sends user identifiers across all events', () => {
      const { result } = renderHook(() => usePurchaseModalTelemetry());
      act(() => {
        result.current.trackModalViewed({ itemName: 'Item', currency: 'USD', value: 5 });
        result.current.trackModalCanceled({ itemName: 'Item', currency: 'USD', value: 5 });
        result.current.trackModalConfirmed({ itemName: 'Item', currency: 'USD', value: 5 });
      });
      const calls = (track as ReturnType<typeof vi.fn>).mock.calls as [string, Record<string, unknown>][];
      calls.forEach(([, payload]) => {
        expect(payload).not.toHaveProperty('user_id');
        expect(payload).not.toHaveProperty('wallet_address');
        expect(payload).not.toHaveProperty('session_id');
        expect(payload).not.toHaveProperty('email');
      });
    });
  });

  describe('callback stability', () => {
    it('returns stable references across re-renders with same route', () => {
      const { result, rerender } = renderHook(
        ({ route }: { route: string }) => usePurchaseModalTelemetry(route),
        { initialProps: { route: '/shop' } },
      );
      const { trackModalViewed, trackModalCanceled, trackModalConfirmed } = result.current;
      rerender({ route: '/shop' });
      expect(result.current.trackModalViewed).toBe(trackModalViewed);
      expect(result.current.trackModalCanceled).toBe(trackModalCanceled);
      expect(result.current.trackModalConfirmed).toBe(trackModalConfirmed);
    });

    it('updates callbacks when route changes', () => {
      const { result, rerender } = renderHook(
        ({ route }: { route: string }) => usePurchaseModalTelemetry(route),
        { initialProps: { route: '/shop' } },
      );
      act(() => { result.current.trackModalViewed({}); });
      expect(track).toHaveBeenCalledWith('purchase_modal_viewed', expect.objectContaining({ route: '/shop' }));

      vi.clearAllMocks();
      rerender({ route: '/promo-shop' });
      act(() => { result.current.trackModalViewed({}); });
      expect(track).toHaveBeenCalledWith('purchase_modal_viewed', expect.objectContaining({ route: '/promo-shop' }));
    });
  });

  describe('no duplicate events on re-render', () => {
    it('does not fire events on re-render without explicit call', () => {
      const { result, rerender } = renderHook(
        ({ route }: { route: string }) => usePurchaseModalTelemetry(route),
        { initialProps: { route: '/shop' } },
      );
      act(() => { result.current.trackModalViewed({}); });
      const callCountBefore = (track as ReturnType<typeof vi.fn>).mock.calls.length;
      rerender({ route: '/shop' });
      expect((track as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCountBefore);
    });
  });

  describe('disconnected or unavailable telemetry provider', () => {
    it('propagates error when track throws', () => {
      (track as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
        throw new Error('Telemetry provider unavailable');
      });
      const { result } = renderHook(() => usePurchaseModalTelemetry());
      expect(() => {
        act(() => { result.current.trackModalViewed({}); });
      }).toThrow('Telemetry provider unavailable');
    });

    it('recovers and fires events after provider recovers', () => {
      const mockTrack = track as ReturnType<typeof vi.fn>;
      mockTrack.mockImplementationOnce(() => { throw new Error('Provider down'); });
      const { result } = renderHook(() => usePurchaseModalTelemetry());

      try { act(() => { result.current.trackModalViewed({}); }); } catch { /* expected */ }

      mockTrack.mockClear();
      mockTrack.mockImplementation(() => {});
      act(() => { result.current.trackModalConfirmed({ itemName: 'Item' }); });
      expect(mockTrack).toHaveBeenCalledWith('purchase_modal_confirmed', expect.any(Object));
    });
  });

  describe('unmount safety', () => {
    it('does not throw on unmount', () => {
      const { unmount } = renderHook(() => usePurchaseModalTelemetry());
      expect(() => { unmount(); }).not.toThrow();
    });

    it('callbacks remain callable after unmount without crashing', () => {
      const { result, unmount } = renderHook(() => usePurchaseModalTelemetry());
      const ref = result.current.trackModalViewed;
      unmount();
      expect(() => { ref({}); }).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('handles null route gracefully', () => {
      const { result } = renderHook(() => usePurchaseModalTelemetry(null as unknown as string));
      act(() => { result.current.trackModalViewed({}); });
      expect(track).toHaveBeenCalled();
    });

    it('handles empty string route', () => {
      const { result } = renderHook(() => usePurchaseModalTelemetry(''));
      act(() => { result.current.trackModalViewed({}); });
      expect(track).toHaveBeenCalledWith('purchase_modal_viewed', expect.objectContaining({ route: '' }));
    });

    it('handles zero as a valid value', () => {
      const { result } = renderHook(() => usePurchaseModalTelemetry());
      act(() => { result.current.trackModalViewed({ value: 0 }); });
      expect(track).toHaveBeenCalledWith('purchase_modal_viewed', expect.objectContaining({ value: 0 }));
    });
  });
});
