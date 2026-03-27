/**
 * Onboarding Tour Component
 * Coach marks/modal tour for first-time players
 * Features: dismiss, don't show again, mobile-friendly, skip tour, analytics
 */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/providers/auth-provider";

interface TourStep {
  id: string;
  title: string;
  description: string;
  targetSelector: string;
  position: "top" | "bottom" | "left" | "right";
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Tycoon!",
    description: "Let's take a quick tour of the game board and core features.",
    targetSelector: "[data-slot='go']",
    position: "top",
  },
  {
    id: "properties",
    title: "Properties",
    description: "Buy properties to build your empire. Different colors represent different property groups.",
    targetSelector: "[data-square-type='property']",
    position: "top",
  },
  {
    id: "chance",
    title: "Chance Cards",
    description: "Land on Chance squares to draw cards with random rewards or penalties.",
    targetSelector: "[data-slot='chance']",
    position: "bottom",
  },
  {
    id: "community-chest",
    title: "Community Chest",
    description: "Community Chest cards offer various bonuses and challenges.",
    targetSelector: "[data-slot='community-chest']",
    position: "bottom",
  },
  {
    id: "free-parking",
    title: "Free Parking",
    description: "A safe space where nothing happens. Take a breather!",
    targetSelector: "[data-slot='free-parking']",
    position: "bottom",
  },
  {
    id: "go-to-jail",
    title: "Go to Jail",
    description: "Avoid this square! Landing here sends you directly to jail.",
    targetSelector: "[data-slot='go-to-jail']",
    position: "bottom",
  },
];

interface OnboardingTourProps {
  onComplete?: () => void;
  onSkip?: () => void;
}

export default function OnboardingTour({ onComplete, onSkip }: OnboardingTourProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  const getStorageKey = useCallback(() => {
    return user?.id ? `onboarding_tour_completed_${user.id}` : "onboarding_tour_completed_guest";
  }, [user?.id]);

  const getDontShowKey = useCallback(() => {
    return user?.id ? `onboarding_tour_dont_show_${user.id}` : "onboarding_tour_dont_show_guest";
  }, [user?.id]);

  useEffect(() => {
    const completed = localStorage.getItem(getStorageKey());
    const dontShow = localStorage.getItem(getDontShowKey());
    
    if (!completed && dontShow !== "true") {
      // Delay showing tour to ensure DOM is ready
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [getStorageKey, getDontShowKey]);

  useEffect(() => {
    if (!isVisible || currentStep >= TOUR_STEPS.length) return;

    const step = TOUR_STEPS[currentStep];
    const element = document.querySelector(step.targetSelector) as HTMLElement;
    
    if (element) {
      setTargetElement(element);
      updateTooltipPosition(element, step.position);
      
      // Add highlight to target element
      element.style.position = "relative";
      element.style.zIndex = "60";
      element.style.boxShadow = "0 0 0 4px rgba(0, 240, 255, 0.5), 0 0 20px rgba(0, 240, 255, 0.3)";
      element.style.borderRadius = "4px";
    }

    return () => {
      if (element) {
        element.style.position = "";
        element.style.zIndex = "";
        element.style.boxShadow = "";
        element.style.borderRadius = "";
      }
    };
  }, [isVisible, currentStep]);

  const updateTooltipPosition = (element: HTMLElement, position: string) => {
    const rect = element.getBoundingClientRect();
    const tooltipWidth = 320;
    const tooltipHeight = 150;
    const offset = 16;

    let top = 0;
    let left = 0;

    switch (position) {
      case "top":
        top = rect.top - tooltipHeight - offset;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "bottom":
        top = rect.bottom + offset;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "left":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - offset;
        break;
      case "right":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + offset;
        break;
    }

    // Keep tooltip within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (left < 16) left = 16;
    if (left + tooltipWidth > viewportWidth - 16) left = viewportWidth - tooltipWidth - 16;
    if (top < 16) top = 16;
    if (top + tooltipHeight > viewportHeight - 16) top = viewportHeight - tooltipHeight - 16;

    setTooltipPosition({ top, left });
  };

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTour();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    if (dontShowAgain) {
      localStorage.setItem(getDontShowKey(), "true");
    }
    setIsVisible(false);
    trackAnalyticsEvent("tour_skipped", { step: currentStep });
    onSkip?.();
  };

  const completeTour = () => {
    localStorage.setItem(getStorageKey(), "true");
    if (dontShowAgain) {
      localStorage.setItem(getDontShowKey(), "true");
    }
    setIsVisible(false);
    trackAnalyticsEvent("tour_completed", { totalSteps: TOUR_STEPS.length });
    onComplete?.();
  };

  const trackAnalyticsEvent = (eventName: string, data: Record<string, unknown>) => {
    // Analytics tracking - can be integrated with any analytics provider
    console.log(`[Analytics] ${eventName}`, {
      ...data,
      userId: user?.id || "guest",
      timestamp: new Date().toISOString(),
    });
    
    // Send to backend analytics endpoint
    fetch("/api/analytics/tour", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: eventName,
        data,
        userId: user?.id,
      }),
    }).catch((err) => console.error("Analytics error:", err));
  };

  if (!isVisible) return null;

  const step = TOUR_STEPS[currentStep];
  const progress = ((currentStep + 1) / TOUR_STEPS.length) * 100;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/60 z-50"
        onClick={handleSkip}
        aria-hidden="true"
      />

      {/* Tooltip */}
      <div
        className="fixed z-[60] w-[320px] max-w-[calc(100vw-32px)] bg-[#0A1A1B] border border-[#00F0FF]/30 rounded-xl shadow-2xl p-4 sm:p-5"
        style={{
          top: `${tooltipPosition.top}px`,
          left: `${tooltipPosition.left}px`,
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-description"
      >
        {/* Progress bar */}
        <div className="w-full h-1 bg-[#003B3E] rounded-full mb-4">
          <div
            className="h-full bg-[#00F0FF] rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-[#00F0FF]/70 font-orbitron">
            Step {currentStep + 1} of {TOUR_STEPS.length}
          </span>
          <button
            onClick={handleSkip}
            className="text-xs text-[#00F0FF]/70 hover:text-[#00F0FF] transition-colors"
            aria-label="Skip tour"
          >
            Skip Tour
          </button>
        </div>

        {/* Content */}
        <h3
          id="tour-title"
          className="text-lg font-orbitron font-bold text-[#00F0FF] mb-2"
        >
          {step.title}
        </h3>
        <p
          id="tour-description"
          className="text-sm text-[#00F0FF]/80 mb-4 leading-relaxed"
        >
          {step.description}
        </p>

        {/* Don't show again checkbox */}
        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            className="w-4 h-4 rounded border-[#00F0FF]/30 bg-[#0A1A1B] text-[#00F0FF] focus:ring-[#00F0FF]/50"
          />
          <span className="text-xs text-[#00F0FF]/70">Don't show this tour again</span>
        </label>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="px-4 py-2 text-sm font-orbitron text-[#00F0FF]/70 hover:text-[#00F0FF] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <button
            onClick={handleNext}
            className="px-6 py-2 text-sm font-orbitron font-bold bg-[#00F0FF] text-[#0A1A1B] rounded-lg hover:bg-[#00F0FF]/90 transition-colors"
          >
            {currentStep === TOUR_STEPS.length - 1 ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </>
  );
}
