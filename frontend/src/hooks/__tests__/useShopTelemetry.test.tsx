import { renderHook, act } from '@testing-library/react';
import { useShopTelemetry } from '../useShopTelemetry';
import { track } from '@/lib/analytics';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}));

describe('useShopTelemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('returns all three tracking functions', () => {
      const { result } = renderHook(() => useShopTelemetry());
      expect(result.current.trackGridViewed).toBeDefined();
      expect(result.current.trackItemImpression).toBeDefined();
      expect(result.current.trackPurchaseInitiated).toBeDefined();
    });

    it('uses default route "/shop"', () => {
      const { result } = renderHook(() => useShopTelemetry());
      act(() => { result.current.trackGridViewed(5); });
      expect(track).toHaveBeenCalledWith('shop_grid_viewed', expect.objectContaining({ route: '/shop' }));
    });

    it('accepts a custom route', () => {
      const { result } = renderHook(() => useShopTelemetry('/featured'));
      act(() => { result.current.trackGridViewed(3); });
      expect(track).toHaveBeenCalledWith('shop_grid_viewed', expect.objectContaining({ route: '/featured' }));
    });
  });

  describe('trackGridViewed', () => {
    it('tracks shop_grid_viewed with item count and default source', () => {
      const { result } = renderHook(() => useShopTelemetry());
      act(() => { result.current.trackGridViewed(12); });
      expect(track).toHaveBeenCalledWith('shop_grid_viewed', {
        route: '/shop',
        item_count: 12,
        source: 'page_load',
      });
    });

    it('tracks with custom source', () => {
      const { result } = renderHook(() => useShopTelemetry());
      act(() => { result.current.trackGridViewed(6, 'filter_change'); });
      expect(track).toHaveBeenCalledWith('shop_grid_viewed', {
        route: '/shop',
        item_count: 6,
        source: 'filter_change',
      });
    });

    it('tracks zero items', () => {
      const { result } = renderHook(() => useShopTelemetry());
      act(() => { result.current.trackGridViewed(0); });
      expect(track).toHaveBeenCalledWith('shop_grid_viewed', expect.objectContaining({ item_count: 0 }));
    });

    it('tracks large item count', () => {
      const { result } = renderHook(() => useShopTelemetry());
      act(() => { result.current.trackGridViewed(999); });
      expect(track).toHaveBeenCalledWith('shop_grid_viewed', expect.objectContaining({ item_count: 999 }));
    });

    it('does not include PII', () => {
      const { result } = renderHook(() => useShopTelemetry());
      act(() => { result.current.trackGridViewed(5); });
      const payload = (track as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(payload).not.toHaveProperty('user_id');
      expect(payload).not.toHaveProperty('wallet_address');
      expect(payload).not.toHaveProperty('session_id');
    });
  });

  describe('trackItemImpression', () => {
    it('tracks shop_item_impression with all fields', () => {
      const { result } = renderHook(() => useShopTelemetry());
      act(() => {
        result.current.trackItemImpression({
          itemId: 'item-001',
          itemName: 'Dragon Shield',
          itemCategory: 'armor',
          itemRarity: 'legendary',
        });
      });
      expect(track).toHaveBeenCalledWith('shop_item_impression', {
        route: '/shop',
        item_id: 'item-001',
        item_name: 'Dragon Shield',
        item_category: 'armor',
        item_rarity: 'legendary',
      });
    });

    it('tracks with only required fields (itemId, itemName)', () => {
      const { result } = renderHook(() => useShopTelemetry());
      act(() => {
        result.current.trackItemImpression({ itemId: 'item-002', itemName: 'Iron Sword' });
      });
      expect(track).toHaveBeenCalledWith('shop_item_impression', {
        route: '/shop',
        item_id: 'item-002',
        item_name: 'Iron Sword',
        item_category: undefined,
        item_rarity: undefined,
      });
    });

    it('does not include currency or value fields', () => {
      const { result } = renderHook(() => useShopTelemetry());
      act(() => {
        result.current.trackItemImpression({ itemId: 'x', itemName: 'y', currency: 'USD', value: 5 });
      });
      const payload = (track as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(payload).not.toHaveProperty('currency');
      expect(payload).not.toHaveProperty('value');
    });

    it('does not include PII', () => {
      const { result } = renderHook(() => useShopTelemetry());
      act(() => {
        result.current.trackItemImpression({ itemId: 'item-003', itemName: 'Test Item' });
      });
      const payload = (track as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(payload).not.toHaveProperty('user_id');
      expect(payload).not.toHaveProperty('wallet_address');
    });
  });

  describe('trackPurchaseInitiated', () => {
    it('tracks shop_purchase_initiated with all fields', () => {
      const { result } = renderHook(() => useShopTelemetry());
      act(() => {
        result.current.trackPurchaseInitiated({
          itemId: 'item-100',
          itemName: 'Epic Mount',
          itemCategory: 'mount',
          itemRarity: 'epic',
          currency: 'XLM',
          value: 50,
        });
      });
      expect(track).toHaveBeenCalledWith('shop_purchase_initiated', {
        route: '/shop',
        item_id: 'item-100',
        item_name: 'Epic Mount',
        item_category: 'mount',
        item_rarity: 'epic',
        currency: 'XLM',
        value: 50,
      });
    });

    it('tracks with only required fields', () => {
      const { result } = renderHook(() => useShopTelemetry());
      act(() => {
        result.current.trackPurchaseInitiated({ itemId: 'item-200', itemName: 'Basic Sword' });
      });
      expect(track).toHaveBeenCalledWith('shop_purchase_initiated', {
        route: '/shop',
        item_id: 'item-200',
        item_name: 'Basic Sword',
        item_category: undefined,
        item_rarity: undefined,
        currency: undefined,
        value: undefined,
      });
    });

    it('accepts string value', () => {
      const { result } = renderHook(() => useShopTelemetry());
      act(() => {
        result.current.trackPurchaseInitiated({ itemId: 'i', itemName: 'n', value: '9.99' });
      });
      expect(track).toHaveBeenCalledWith('shop_purchase_initiated', expect.objectContaining({ value: '9.99' }));
    });

    it('does not include PII', () => {
      const { result } = renderHook(() => useShopTelemetry());
      act(() => {
        result.current.trackPurchaseInitiated({ itemId: 'item-300', itemName: 'Rare Gem' });
      });
      const payload = (track as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(payload).not.toHaveProperty('user_id');
      expect(payload).not.toHaveProperty('wallet_address');
      expect(payload).not.toHaveProperty('session_id');
    });
  });

  describe('privacy compliance', () => {
    it('never sends user identifiers across all events', () => {
      const { result } = renderHook(() => useShopTelemetry());
      act(() => {
        result.current.trackGridViewed(5);
        result.current.trackItemImpression({ itemId: 'x', itemName: 'y' });
        result.current.trackPurchaseInitiated({ itemId: 'x', itemName: 'y' });
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
        ({ route }: { route: string }) => useShopTelemetry(route),
        { initialProps: { route: '/shop' } },
      );
      const { trackGridViewed, trackItemImpression, trackPurchaseInitiated } = result.current;
      rerender({ route: '/shop' });
      expect(result.current.trackGridViewed).toBe(trackGridViewed);
      expect(result.current.trackItemImpression).toBe(trackItemImpression);
      expect(result.current.trackPurchaseInitiated).toBe(trackPurchaseInitiated);
    });

    it('updates callbacks when route changes', () => {
      const { result, rerender } = renderHook(
        ({ route }: { route: string }) => useShopTelemetry(route),
        { initialProps: { route: '/shop' } },
      );
      act(() => { result.current.trackGridViewed(1); });
      expect(track).toHaveBeenCalledWith('shop_grid_viewed', expect.objectContaining({ route: '/shop' }));

      vi.clearAllMocks();
      rerender({ route: '/seasonal-shop' });
      act(() => { result.current.trackGridViewed(1); });
      expect(track).toHaveBeenCalledWith('shop_grid_viewed', expect.objectContaining({ route: '/seasonal-shop' }));
    });
  });

  describe('no duplicate events on re-render', () => {
    it('does not fire events on re-render without an explicit call', () => {
      const { result, rerender } = renderHook(
        ({ route }: { route: string }) => useShopTelemetry(route),
        { initialProps: { route: '/shop' } },
      );
      act(() => { result.current.trackGridViewed(4); });
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
      const { result } = renderHook(() => useShopTelemetry());
      expect(() => {
        act(() => { result.current.trackGridViewed(1); });
      }).toThrow('Telemetry provider unavailable');
    });

    it('recovers and fires events after provider recovers', () => {
      const mockTrack = track as ReturnType<typeof vi.fn>;
      mockTrack.mockImplementationOnce(() => { throw new Error('Provider down'); });
      const { result } = renderHook(() => useShopTelemetry());

      try { act(() => { result.current.trackGridViewed(1); }); } catch { /* expected */ }

      mockTrack.mockClear();
      mockTrack.mockImplementation(() => {});
      act(() => { result.current.trackItemImpression({ itemId: 'x', itemName: 'y' }); });
      expect(mockTrack).toHaveBeenCalledWith('shop_item_impression', expect.any(Object));
    });
  });

  describe('unmount safety', () => {
    it('does not throw on unmount', () => {
      const { unmount } = renderHook(() => useShopTelemetry());
      expect(() => { unmount(); }).not.toThrow();
    });

    it('callbacks remain callable after unmount without crashing', () => {
      const { result, unmount } = renderHook(() => useShopTelemetry());
      const { trackGridViewed } = result.current;
      unmount();
      expect(() => { trackGridViewed(1); }).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('handles null route gracefully', () => {
      const { result } = renderHook(() => useShopTelemetry(null as unknown as string));
      act(() => { result.current.trackGridViewed(1); });
      expect(track).toHaveBeenCalled();
    });

    it('handles empty string source in trackGridViewed', () => {
      const { result } = renderHook(() => useShopTelemetry());
      act(() => { result.current.trackGridViewed(1, ''); });
      expect(track).toHaveBeenCalledWith('shop_grid_viewed', expect.objectContaining({ source: '' }));
    });
  });
});
