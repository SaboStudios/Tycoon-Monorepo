/**
 * Hook for managing onboarding tour state
 * Handles tour visibility, progress, and persistence
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/providers/auth-provider";

interface UseOnboardingTourOptions {
  onComplete?: () => void;
  onSkip?: () => void;
}

interface UseOnboardingTourReturn {
  isTourVisible: boolean;
  showTour: () => void;
  hideTour: () => void;
  resetTour: () => void;
  hasCompletedTour: boolean;
  hasSkippedTour: boolean;
}

export function useOnboardingTour(
  options: UseOnboardingTourOptions = {}
): UseOnboardingTourReturn {
  const { user } = useAuth();
  const [isTourVisible, setIsTourVisible] = useState(false);
  const [hasCompletedTour, setHasCompletedTour] = useState(false);
  const [hasSkippedTour, setHasSkippedTour] = useState(false);

  const getStorageKey = useCallback(() => {
    return user?.id
      ? `onboarding_tour_completed_${user.id}`
      : "onboarding_tour_completed_guest";
  }, [user?.id]);

  const getDontShowKey = useCallback(() => {
    return user?.id
      ? `onboarding_tour_dont_show_${user.id}`
      : "onboarding_tour_dont_show_guest";
  }, [user?.id]);

  useEffect(() => {
    const completed = localStorage.getItem(getStorageKey());
    const dontShow = localStorage.getItem(getDontShowKey());

    setHasCompletedTour(completed === "true");
    setHasSkippedTour(dontShow === "true");
  }, [getStorageKey, getDontShowKey]);

  const showTour = useCallback(() => {
    setIsTourVisible(true);
  }, []);

  const hideTour = useCallback(() => {
    setIsTourVisible(false);
  }, []);

  const resetTour = useCallback(() => {
    localStorage.removeItem(getStorageKey());
    localStorage.removeItem(getDontShowKey());
    setHasCompletedTour(false);
    setHasSkippedTour(false);
    setIsTourVisible(false);
  }, [getStorageKey, getDontShowKey]);

  const handleComplete = useCallback(() => {
    localStorage.setItem(getStorageKey(), "true");
    setHasCompletedTour(true);
    setIsTourVisible(false);
    options.onComplete?.();
  }, [getStorageKey, options]);

  const handleSkip = useCallback(() => {
    localStorage.setItem(getDontShowKey(), "true");
    setHasSkippedTour(true);
    setIsTourVisible(false);
    options.onSkip?.();
  }, [getDontShowKey, options]);

  return {
    isTourVisible,
    showTour,
    hideTour,
    resetTour,
    hasCompletedTour,
    hasSkippedTour,
  };
}
