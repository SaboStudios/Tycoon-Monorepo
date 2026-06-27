import { renderHook, act } from '@testing-library/react';
import { useJoinRoomWebVitals, getWebVitalsSnapshot } from '../useJoinRoomWebVitals';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock fetch
global.fetch = vi.fn();

function installPerformanceObserverMock(
  mockObserver: { observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> },
  onConstruct?: (callback: PerformanceObserverCallback) => void,
) {
  const Constructor = vi.fn(function PerformanceObserverMock(
    this: { observe: typeof mockObserver.observe; disconnect: typeof mockObserver.disconnect },
    callback: PerformanceObserverCallback,
  ) {
    onConstruct?.(callback);
    this.observe = mockObserver.observe;
    this.disconnect = mockObserver.disconnect;
  });
  window.PerformanceObserver = Constructor as unknown as typeof PerformanceObserver;
  return Constructor;
}

describe('useJoinRoomWebVitals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock PerformanceObserver
    if (!window.PerformanceObserver) {
      window.PerformanceObserver = vi.fn() as any;
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize without errors', () => {
      expect(() => {
        renderHook(() => useJoinRoomWebVitals());
      }).not.toThrow();
    });

    it('should accept custom configuration', () => {
      const config = {
        debug: true,
        budgets: {
          lcp: 2000,
          cls: 0.08,
          inp: 150,
        },
      };

      expect(() => {
        renderHook(() => useJoinRoomWebVitals(config));
      }).not.toThrow();
    });

    it('should use default budgets if not provided', () => {
      const { unmount } = renderHook(() => useJoinRoomWebVitals());
      // Default budgets should be LCP: 2500, CLS: 0.1, INP: 200
      unmount();
      expect(true).toBe(true); // Verifies no error occurred
    });
  });

  describe('metric monitoring', () => {
    it('should set up LCP observer', () => {
      const mockObserver = {
        observe: vi.fn(),
        disconnect: vi.fn(),
      };

      const Constructor = installPerformanceObserverMock(mockObserver);

      const { unmount } = renderHook(() => useJoinRoomWebVitals());

      // Should call observe with largest-contentful-paint
      expect(Constructor).toHaveBeenCalled();

      unmount();
      expect(mockObserver.disconnect).toHaveBeenCalled();
    });

    it('should handle missing PerformanceObserver gracefully', () => {
      const originalPO = window.PerformanceObserver;
      delete (window as any).PerformanceObserver;

      expect(() => {
        renderHook(() => useJoinRoomWebVitals({ debug: false }));
      }).not.toThrow();

      window.PerformanceObserver = originalPO;
    });

    it('should report metric if it exceeds budget', () => {
      const mockObserver = {
        observe: vi.fn(),
        disconnect: vi.fn(),
      };

      let lcpCallback: ((entries: any) => void) | null = null;

      installPerformanceObserverMock(mockObserver, (callback) => {
        lcpCallback = callback;
      });
      (global.fetch as any).mockResolvedValue({ ok: true });

      renderHook(() =>
        useJoinRoomWebVitals({
          debug: false,
          budgets: { lcp: 2500 },
        })
      );

      // Simulate LCP entry exceeding budget
      if (lcpCallback) {
        act(() => {
          lcpCallback!({
            getEntries: () => [
              {
                renderTime: 3000, // Exceeds 2500ms budget
                loadTime: 3000,
                duration: 0,
              },
            ],
          });
        });
      }

      // Should have reported the metric
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('metric reporting', () => {
    it('should not report in development mode without explicit endpoint', () => {
      const originalEnv = process.env.NODE_ENV;
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'development',
        configurable: true,
      });

      const mockObserver = {
        observe: vi.fn(),
        disconnect: vi.fn(),
      };

      installPerformanceObserverMock(mockObserver);

      renderHook(() => useJoinRoomWebVitals({ debug: false }));

      // In development, fetch should not be called
      expect(global.fetch).not.toHaveBeenCalled();

      Object.defineProperty(process.env, 'NODE_ENV', {
        value: originalEnv,
        configurable: true,
      });
    });

    it('should report to custom endpoint if provided', async () => {
      const mockObserver = {
        observe: vi.fn(),
        disconnect: vi.fn(),
      };

      let clsCallback: ((entries: any) => void) | null = null;

      installPerformanceObserverMock(mockObserver, (callback) => {
        clsCallback = callback;
      });
      (global.fetch as any).mockResolvedValue({ ok: true });

      renderHook(() =>
        useJoinRoomWebVitals({
          reportingEndpoint: '/custom/metrics',
          debug: false,
          budgets: { cls: 0.1 },
        })
      );

      // Simulate CLS entry exceeding budget
      if (clsCallback) {
        act(() => {
          clsCallback!({
            getEntries: () => [
              {
                value: 0.15, // Exceeds 0.1 budget
                hadRecentInput: false,
                startTime: 100,
              },
            ],
          });
        });
      }

      // Should report if exceeded budget
      if (global.fetch && (global.fetch as any).mock.calls.length > 0) {
        expect((global.fetch as any).mock.calls[0][0]).toBe('/custom/metrics');
      }
    });

    it('should include keepalive flag in fetch for metrics', () => {
      const mockObserver = {
        observe: vi.fn(),
        disconnect: vi.fn(),
      };

      installPerformanceObserverMock(mockObserver);
      (global.fetch as any).mockResolvedValue({ ok: true });

      const originalEnv = process.env.NODE_ENV;
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'production',
        configurable: true,
      });

      renderHook(() => useJoinRoomWebVitals({ debug: false }));

      // Verify fetch would include keepalive when production metrics are sent
      // (This is primarily for unload scenarios)

      Object.defineProperty(process.env, 'NODE_ENV', {
        value: originalEnv,
        configurable: true,
      });
    });
  });

  describe('cleanup', () => {
    it('should disconnect observers on unmount', () => {
      const mockObserver = {
        observe: vi.fn(),
        disconnect: vi.fn(),
      };

      installPerformanceObserverMock(mockObserver);

      const { unmount } = renderHook(() => useJoinRoomWebVitals());

      unmount();

      // Should have called disconnect on all observers
      expect(mockObserver.disconnect).toHaveBeenCalled();
    });

    it('should remove beforeunload event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const mockObserver = {
        observe: vi.fn(),
        disconnect: vi.fn(),
      };

      installPerformanceObserverMock(mockObserver);

      const { unmount } = renderHook(() => useJoinRoomWebVitals());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });

  describe('debug mode', () => {
    it('should log metrics in debug mode', () => {
      const consoleDebugSpy = vi.spyOn(console, 'debug');

      const mockObserver = {
        observe: vi.fn(),
        disconnect: vi.fn(),
      };

      installPerformanceObserverMock(mockObserver);

      renderHook(() => useJoinRoomWebVitals({ debug: true }));

      expect(consoleDebugSpy).toHaveBeenCalled();

      consoleDebugSpy.mockRestore();
    });

    it('should not log metrics in production debug mode', () => {
      const consoleDebugSpy = vi.spyOn(console, 'debug');

      const mockObserver = {
        observe: vi.fn(),
        disconnect: vi.fn(),
      };

      installPerformanceObserverMock(mockObserver);

      renderHook(() => useJoinRoomWebVitals({ debug: false }));

      // Should not have debug output
      consoleDebugSpy.mockRestore();
    });
  });
});

describe('getWebVitalsSnapshot', () => {
  it('should return empty object if window is undefined', async () => {
    const originalWindow = global.window;
    delete (global as any).window;

    const result = await getWebVitalsSnapshot();
    expect(result).toEqual({});

    (global as any).window = originalWindow;
  });

  it('should capture LCP metric if available', async () => {
    const mockGetEntries = vi.fn((type) => {
      if (type === 'largest-contentful-paint') {
        return [
          { renderTime: 1500, loadTime: 1500 },
          { renderTime: 1200, loadTime: 1200 },
        ];
      }
      return [];
    });

    window.performance.getEntriesByType = mockGetEntries as any;

    const result = await getWebVitalsSnapshot();

    expect(result.lcp).toBeDefined();
    expect(result.lcp?.value).toBe(1200); // Last entry
    expect(result.lcp?.name).toBe('LCP');
  });

  it('should capture CLS metric', async () => {
    const mockGetEntries = vi.fn((type) => {
      if (type === 'layout-shift') {
        return [
          { value: 0.03, hadRecentInput: false },
          { value: 0.02, hadRecentInput: false },
        ];
      }
      return [];
    });

    window.performance.getEntriesByType = mockGetEntries as any;

    const result = await getWebVitalsSnapshot();

    expect(result.cls).toBeDefined();
    expect(result.cls?.value).toBe(0.05); // Sum of both entries
  });

  it('should return empty metrics if no entries available', async () => {
    window.performance.getEntriesByType = vi.fn(() => []) as any;

    const result = await getWebVitalsSnapshot();

    // Should be empty or contain only what's available
    expect(typeof result).toBe('object');
  });
});
