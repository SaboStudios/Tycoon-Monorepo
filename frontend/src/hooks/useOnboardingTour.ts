/**
 * Hook for managing onboarding tour state
 * Handles tour visibility, progress, and persistence
 */
"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/components/providers/auth-provider";

interface UseOnboardingTourOptions {
  onComplete?: () => void;
  onSkip?: () => void;
}

interface UseOnboardingTourReturn {
  isTourVisible: boolean;
  showTour: () => void;
  hideTour: () => void;
  completeTour: () => void;
  skipTour: () => void;
  resetTour: () => void;
  hasCompletedTour: boolean;
  hasSkippedTour: boolean;
}

export function useOnboardingTour(
  options: UseOnboardingTourOptions = {}
): UseOnboardingTourReturn {
  const { user } = useAuth();
  const userId = user?.id;

  const getStorageKey = useCallback(
    () =>
      userId
        ? `onboarding_tour_completed_${userId}`
        : "onboarding_tour_completed_guest",
    [userId],
  );

  const getDontShowKey = useCallback(
    () =>
      userId
        ? `onboarding_tour_dont_show_${userId}`
        : "onboarding_tour_dont_show_guest",
    [userId],
  );

  // Track which userId we last read from storage so we can re-sync when user changes.
  const [lastReadUserId, setLastReadUserId] = useState<typeof userId>(userId);
  const [isTourVisible, setIsTourVisible] = useState(false);
  const [hasCompletedTour, setHasCompletedTour] = useState(
    () => localStorage.getItem(getStorageKey()) === "true",
  );
  const [hasSkippedTour, setHasSkippedTour] = useState(
    () => localStorage.getItem(getDontShowKey()) === "true",
  );

  // Re-read from storage when the authenticated user changes (setState-during-render
  // pattern for derived state — avoids setState inside an effect).
  if (lastReadUserId !== userId) {
    setLastReadUserId(userId);
    setHasCompletedTour(localStorage.getItem(getStorageKey()) === "true");
    setHasSkippedTour(localStorage.getItem(getDontShowKey()) === "true");
  }

  const showTour = useCallback(() => setIsTourVisible(true), []);

  const hideTour = useCallback(() => setIsTourVisible(false), []);

  const completeTour = useCallback(() => {
    localStorage.setItem(getStorageKey(), "true");
    setHasCompletedTour(true);
    setIsTourVisible(false);
    options.onComplete?.();
  }, [getStorageKey, options]);

  const skipTour = useCallback(() => {
    localStorage.setItem(getDontShowKey(), "true");
    setHasSkippedTour(true);
    setIsTourVisible(false);
    options.onSkip?.();
  }, [getDontShowKey, options]);

  const resetTour = useCallback(() => {
    localStorage.removeItem(getStorageKey());
    localStorage.removeItem(getDontShowKey());
    setHasCompletedTour(false);
    setHasSkippedTour(false);
    setIsTourVisible(false);
  }, [getStorageKey, getDontShowKey]);

  return {
    isTourVisible,
    showTour,
    hideTour,
    completeTour,
    skipTour,
    resetTour,
    hasCompletedTour,
    hasSkippedTour,
  };
}
