import { renderHook, act } from '@testing-library/react';
import { useOnboardingTour } from '../useOnboardingTour';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '@/components/providers/auth-provider';

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

describe('useOnboardingTour', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUseAuth.mockReturnValue({ user: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('returns all expected values and functions', () => {
      const { result } = renderHook(() => useOnboardingTour());
      expect(result.current.isTourVisible).toBe(false);
      expect(typeof result.current.showTour).toBe('function');
      expect(typeof result.current.hideTour).toBe('function');
      expect(typeof result.current.completeTour).toBe('function');
      expect(typeof result.current.skipTour).toBe('function');
      expect(typeof result.current.resetTour).toBe('function');
      expect(result.current.hasCompletedTour).toBe(false);
      expect(result.current.hasSkippedTour).toBe(false);
    });

    it('reads completed state from localStorage on mount (guest)', () => {
      localStorage.setItem('onboarding_tour_completed_guest', 'true');
      const { result } = renderHook(() => useOnboardingTour());
      expect(result.current.hasCompletedTour).toBe(true);
    });

    it('reads skipped state from localStorage on mount (guest)', () => {
      localStorage.setItem('onboarding_tour_dont_show_guest', 'true');
      const { result } = renderHook(() => useOnboardingTour());
      expect(result.current.hasSkippedTour).toBe(true);
    });

    it('reads completed state from user-scoped key when user is authenticated', () => {
      mockUseAuth.mockReturnValue({ user: { id: 42 } });
      localStorage.setItem('onboarding_tour_completed_42', 'true');
      const { result } = renderHook(() => useOnboardingTour());
      expect(result.current.hasCompletedTour).toBe(true);
    });

    it('reads skipped state from user-scoped key when user is authenticated', () => {
      mockUseAuth.mockReturnValue({ user: { id: 42 } });
      localStorage.setItem('onboarding_tour_dont_show_42', 'true');
      const { result } = renderHook(() => useOnboardingTour());
      expect(result.current.hasSkippedTour).toBe(true);
    });

    it('defaults hasCompletedTour and hasSkippedTour to false when localStorage is empty', () => {
      const { result } = renderHook(() => useOnboardingTour());
      expect(result.current.hasCompletedTour).toBe(false);
      expect(result.current.hasSkippedTour).toBe(false);
    });
  });

  describe('showTour / hideTour', () => {
    it('showTour sets isTourVisible to true', () => {
      const { result } = renderHook(() => useOnboardingTour());
      act(() => { result.current.showTour(); });
      expect(result.current.isTourVisible).toBe(true);
    });

    it('hideTour sets isTourVisible to false', () => {
      const { result } = renderHook(() => useOnboardingTour());
      act(() => { result.current.showTour(); });
      act(() => { result.current.hideTour(); });
      expect(result.current.isTourVisible).toBe(false);
    });

    it('multiple showTour calls keep tour visible', () => {
      const { result } = renderHook(() => useOnboardingTour());
      act(() => { result.current.showTour(); result.current.showTour(); });
      expect(result.current.isTourVisible).toBe(true);
    });
  });

  describe('completeTour', () => {
    it('sets hasCompletedTour to true and hides tour', () => {
      const { result } = renderHook(() => useOnboardingTour());
      act(() => { result.current.showTour(); });
      act(() => { result.current.completeTour(); });
      expect(result.current.hasCompletedTour).toBe(true);
      expect(result.current.isTourVisible).toBe(false);
    });

    it('persists completion to localStorage (guest key)', () => {
      const { result } = renderHook(() => useOnboardingTour());
      act(() => { result.current.completeTour(); });
      expect(localStorage.getItem('onboarding_tour_completed_guest')).toBe('true');
    });

    it('persists completion to user-scoped localStorage key', () => {
      mockUseAuth.mockReturnValue({ user: { id: 7 } });
      const { result } = renderHook(() => useOnboardingTour());
      act(() => { result.current.completeTour(); });
      expect(localStorage.getItem('onboarding_tour_completed_7')).toBe('true');
    });

    it('calls onComplete callback', () => {
      const onComplete = vi.fn();
      const { result } = renderHook(() => useOnboardingTour({ onComplete }));
      act(() => { result.current.completeTour(); });
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('does not throw when onComplete is not provided', () => {
      const { result } = renderHook(() => useOnboardingTour());
      expect(() => { act(() => { result.current.completeTour(); }); }).not.toThrow();
    });
  });

  describe('skipTour', () => {
    it('sets hasSkippedTour to true and hides tour', () => {
      const { result } = renderHook(() => useOnboardingTour());
      act(() => { result.current.showTour(); });
      act(() => { result.current.skipTour(); });
      expect(result.current.hasSkippedTour).toBe(true);
      expect(result.current.isTourVisible).toBe(false);
    });

    it('persists skip to localStorage (guest key)', () => {
      const { result } = renderHook(() => useOnboardingTour());
      act(() => { result.current.skipTour(); });
      expect(localStorage.getItem('onboarding_tour_dont_show_guest')).toBe('true');
    });

    it('persists skip to user-scoped localStorage key', () => {
      mockUseAuth.mockReturnValue({ user: { id: 99 } });
      const { result } = renderHook(() => useOnboardingTour());
      act(() => { result.current.skipTour(); });
      expect(localStorage.getItem('onboarding_tour_dont_show_99')).toBe('true');
    });

    it('calls onSkip callback', () => {
      const onSkip = vi.fn();
      const { result } = renderHook(() => useOnboardingTour({ onSkip }));
      act(() => { result.current.skipTour(); });
      expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('does not throw when onSkip is not provided', () => {
      const { result } = renderHook(() => useOnboardingTour());
      expect(() => { act(() => { result.current.skipTour(); }); }).not.toThrow();
    });
  });

  describe('resetTour', () => {
    it('clears hasCompletedTour and hasSkippedTour', () => {
      const { result } = renderHook(() => useOnboardingTour());
      act(() => { result.current.completeTour(); });
      act(() => { result.current.resetTour(); });
      expect(result.current.hasCompletedTour).toBe(false);
      expect(result.current.hasSkippedTour).toBe(false);
    });

    it('hides tour if visible', () => {
      const { result } = renderHook(() => useOnboardingTour());
      act(() => { result.current.showTour(); });
      act(() => { result.current.resetTour(); });
      expect(result.current.isTourVisible).toBe(false);
    });

    it('removes completion key from localStorage', () => {
      localStorage.setItem('onboarding_tour_completed_guest', 'true');
      const { result } = renderHook(() => useOnboardingTour());
      act(() => { result.current.resetTour(); });
      expect(localStorage.getItem('onboarding_tour_completed_guest')).toBeNull();
    });

    it('removes skip key from localStorage', () => {
      localStorage.setItem('onboarding_tour_dont_show_guest', 'true');
      const { result } = renderHook(() => useOnboardingTour());
      act(() => { result.current.resetTour(); });
      expect(localStorage.getItem('onboarding_tour_dont_show_guest')).toBeNull();
    });
  });

  describe('storage key scoping', () => {
    it('uses guest key when user is null', () => {
      mockUseAuth.mockReturnValue({ user: null });
      const { result } = renderHook(() => useOnboardingTour());
      act(() => { result.current.completeTour(); });
      expect(localStorage.getItem('onboarding_tour_completed_guest')).toBe('true');
      expect(localStorage.getItem('onboarding_tour_completed_undefined')).toBeNull();
    });

    it('uses user-scoped key when user id is available', () => {
      mockUseAuth.mockReturnValue({ user: { id: 123 } });
      const { result } = renderHook(() => useOnboardingTour());
      act(() => { result.current.completeTour(); });
      expect(localStorage.getItem('onboarding_tour_completed_123')).toBe('true');
      expect(localStorage.getItem('onboarding_tour_completed_guest')).toBeNull();
    });
  });

  describe('stale/invalid localStorage values', () => {
    it('treats non-"true" values as false for hasCompletedTour', () => {
      localStorage.setItem('onboarding_tour_completed_guest', 'yes');
      const { result } = renderHook(() => useOnboardingTour());
      expect(result.current.hasCompletedTour).toBe(false);
    });

    it('treats non-"true" values as false for hasSkippedTour', () => {
      localStorage.setItem('onboarding_tour_dont_show_guest', '1');
      const { result } = renderHook(() => useOnboardingTour());
      expect(result.current.hasSkippedTour).toBe(false);
    });
  });

  describe('callback stability', () => {
    it('showTour and hideTour references are stable across re-renders', () => {
      const { result, rerender } = renderHook(() => useOnboardingTour());
      const { showTour, hideTour } = result.current;
      rerender();
      expect(result.current.showTour).toBe(showTour);
      expect(result.current.hideTour).toBe(hideTour);
    });
  });

  describe('unmount safety', () => {
    it('does not throw on unmount', () => {
      const { unmount } = renderHook(() => useOnboardingTour());
      expect(() => { unmount(); }).not.toThrow();
    });

    it('callbacks remain callable after unmount without crashing', () => {
      const { result, unmount } = renderHook(() => useOnboardingTour());
      const { showTour, completeTour } = result.current;
      unmount();
      expect(() => { showTour(); }).not.toThrow();
      expect(() => { completeTour(); }).not.toThrow();
    });
  });
});
