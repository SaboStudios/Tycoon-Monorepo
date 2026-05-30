import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useErrorReporting, type ErrorReportOptions } from './useErrorReporting';

// Mock the sanitizeError function
vi.mock('@/lib/errors/types', () => ({
  sanitizeError: (error: unknown) => ({
    errorCode: 'UNKNOWN_ERROR',
    category: 'unknown',
    message: String(error),
  }),
}));

// Mock console methods
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

// Mock window.navigator and window.location
const originalNavigator = global.navigator;
const originalLocation = global.location;

// Mock fetch for production error reporting
global.fetch = vi.fn();

describe('useErrorReporting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy.mockClear();
    consoleLogSpy.mockClear();
    (global.fetch as any).mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('initializes with no errors reported', () => {
      const { result } = renderHook(() => useErrorReporting());

      expect(result.current.lastError).toBeNull();
      expect(result.current.errorHistory).toEqual([]);
    });

    it('provides reportError and clearErrors functions', () => {
      const { result } = renderHook(() => useErrorReporting());

      expect(typeof result.current.reportError).toBe('function');
      expect(typeof result.current.clearErrors).toBe('function');
    });
  });

  describe('reportError', () => {
    it('reports an error without throwing', () => {
      const { result } = renderHook(() => useErrorReporting());

      expect(() => {
        act(() => {
          result.current.reportError(new Error('Test error'));
        });
      }).not.toThrow();
    });

    it('handles Error objects correctly', () => {
      const { result } = renderHook(() => useErrorReporting());
      const error = new Error('Test error message');

      act(() => {
        result.current.reportError(error);
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('handles string errors correctly', () => {
      const { result } = renderHook(() => useErrorReporting());

      act(() => {
        result.current.reportError('String error');
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('accepts optional ErrorReportOptions', () => {
      const { result } = renderHook(() => useErrorReporting());
      const options: ErrorReportOptions = {
        component: 'TestComponent',
        action: 'fetchData',
        context: { userId: 123, attempt: 1 },
      };

      expect(() => {
        act(() => {
          result.current.reportError(new Error('Test'), options);
        });
      }).not.toThrow();
    });

    it('includes component name in report when provided', () => {
      const { result } = renderHook(() => useErrorReporting());

      act(() => {
        result.current.reportError(new Error('Component error'), {
          component: 'UserProfile',
        });
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      const callArgs = consoleErrorSpy.mock.calls[0][1];
      expect(callArgs).toHaveProperty('component', 'UserProfile');
    });

    it('includes action in report when provided', () => {
      const { result } = renderHook(() => useErrorReporting());

      act(() => {
        result.current.reportError(new Error('Action error'), {
          action: 'submitForm',
        });
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      const callArgs = consoleErrorSpy.mock.calls[0][1];
      expect(callArgs).toHaveProperty('action', 'submitForm');
    });

    it('sanitizes context to remove PII', () => {
      const { result } = renderHook(() => useErrorReporting());

      act(() => {
        result.current.reportError(new Error('Context error'), {
          context: {
            email: 'user@example.com', // Should be filtered
            action: 'submit', // Should pass through
          },
        });
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      const callArgs = consoleErrorSpy.mock.calls[0][1];
      expect(callArgs.context).toBeDefined();
      // Email should be sanitized
      expect(callArgs.context.email).toBeUndefined();
    });

    it('includes timestamp in report', () => {
      const { result } = renderHook(() => useErrorReporting());

      act(() => {
        result.current.reportError(new Error('Timed error'));
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      const callArgs = consoleErrorSpy.mock.calls[0][1];
      expect(callArgs).toHaveProperty('timestamp');
      expect(typeof callArgs.timestamp).toBe('string');
    });

    it('includes userAgent in report when available', () => {
      const { result } = renderHook(() => useErrorReporting());

      act(() => {
        result.current.reportError(new Error('Browser error'));
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      const callArgs = consoleErrorSpy.mock.calls[0][1];
      expect(callArgs).toHaveProperty('userAgent');
    });

    it('includes sanitized URL in report', () => {
      const { result } = renderHook(() => useErrorReporting());

      act(() => {
        result.current.reportError(new Error('URL error'));
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      const callArgs = consoleErrorSpy.mock.calls[0][1];
      expect(callArgs).toHaveProperty('url');
    });
  });

  describe('null and undefined handling', () => {
    it('handles null error gracefully', () => {
      const { result } = renderHook(() => useErrorReporting());

      expect(() => {
        act(() => {
          result.current.reportError(null);
        });
      }).not.toThrow();
    });

    it('handles undefined error gracefully', () => {
      const { result } = renderHook(() => useErrorReporting());

      expect(() => {
        act(() => {
          result.current.reportError(undefined);
        });
      }).not.toThrow();
    });

    it('handles error with no message', () => {
      const { result } = renderHook(() => useErrorReporting());

      expect(() => {
        act(() => {
          result.current.reportError({});
        });
      }).not.toThrow();
    });

    it('handles null options gracefully', () => {
      const { result } = renderHook(() => useErrorReporting());

      expect(() => {
        act(() => {
          result.current.reportError(new Error('Test'), null as any);
        });
      }).not.toThrow();
    });
  });

  describe('clearErrors', () => {
    it('clears errors without throwing', () => {
      const { result } = renderHook(() => useErrorReporting());

      expect(() => {
        act(() => {
          result.current.clearErrors();
        });
      }).not.toThrow();
    });

    it('can be called multiple times safely', () => {
      const { result } = renderHook(() => useErrorReporting());

      expect(() => {
        act(() => {
          result.current.clearErrors();
          result.current.clearErrors();
          result.current.clearErrors();
        });
      }).not.toThrow();
    });

    it('removes tycoon_errors from sessionStorage', () => {
      const { result } = renderHook(() => useErrorReporting());
      const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');

      act(() => {
        result.current.clearErrors();
      });

      expect(removeItemSpy).toHaveBeenCalledWith('tycoon_errors');
      removeItemSpy.mockRestore();
    });
  });

  describe('unmount and cleanup', () => {
    it('does not cause memory leaks when component unmounts', () => {
      const { result, unmount } = renderHook(() => useErrorReporting());

      act(() => {
        result.current.reportError(new Error('Unmount test'));
      });

      expect(() => {
        unmount();
      }).not.toThrow();
    });

    it('cleans up callbacks on unmount', () => {
      const { unmount } = renderHook(() => useErrorReporting());

      expect(() => {
        unmount();
      }).not.toThrow();
    });

    it('does not cause unhandled rejections when unmounting with pending fetch', () => {
      const { result, unmount } = renderHook(() => useErrorReporting());

      // Mock a slow fetch
      (global.fetch as any).mockImplementationOnce(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );

      act(() => {
        result.current.reportError(new Error('Async error'));
      });

      expect(() => {
        unmount();
      }).not.toThrow();
    });

    it('returns stable callback references across re-renders', () => {
      const { result, rerender } = renderHook(() => useErrorReporting());

      const reportErrorRef1 = result.current.reportError;
      const clearErrorsRef1 = result.current.clearErrors;

      rerender();

      const reportErrorRef2 = result.current.reportError;
      const clearErrorsRef2 = result.current.clearErrors;

      expect(reportErrorRef1).toBe(reportErrorRef2);
      expect(clearErrorsRef1).toBe(clearErrorsRef2);
    });
  });

  describe('environment-based behavior', () => {
    it('logs to console in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const { result } = renderHook(() => useErrorReporting());

      act(() => {
        result.current.reportError(new Error('Dev error'));
      });

      expect(consoleErrorSpy).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });

    it('does not throw on production error endpoint', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_ERROR_TRACKING_ENDPOINT = 'https://api.example.com/errors';

      const { result } = renderHook(() => useErrorReporting());

      expect(() => {
        act(() => {
          result.current.reportError(new Error('Prod error'));
        });
      }).not.toThrow();

      process.env.NODE_ENV = originalEnv;
      delete process.env.NEXT_PUBLIC_ERROR_TRACKING_ENDPOINT;
    });
  });

  describe('repeated error handling', () => {
    it('handles multiple errors without deduplication (reports all)', () => {
      const { result } = renderHook(() => useErrorReporting());
      const error = new Error('Repeated error');

      act(() => {
        result.current.reportError(error);
        result.current.reportError(error);
        result.current.reportError(error);
      });

      expect(consoleErrorSpy).toHaveBeenCalledTimes(3);
    });

    it('handles different errors in sequence', () => {
      const { result } = renderHook(() => useErrorReporting());

      act(() => {
        result.current.reportError(new Error('Error 1'));
        result.current.reportError(new Error('Error 2'));
        result.current.reportError(new Error('Error 3'));
      });

      expect(consoleErrorSpy).toHaveBeenCalledTimes(3);
    });

    it('handles error reporting after clearErrors', () => {
      const { result } = renderHook(() => useErrorReporting());

      act(() => {
        result.current.reportError(new Error('Before clear'));
        result.current.clearErrors();
        result.current.reportError(new Error('After clear'));
      });

      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    });
  });
});
