"use client";
import React, { useEffect, useState, useCallback } from "react";
import { Dices, Gamepad2 } from "lucide-react";
import { TypeAnimation } from "react-type-animation";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { useHeroTelemetry } from "@/hooks/useHeroTelemetry";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { sanitizeError } from "@/lib/errors";
import { HERO_I18N } from "@/lib/hero/i18n-keys";

interface HeroSectionProps {
  className?: string;
  router?: {
    push: (href: string) => void;
  };
}

/** Non-empty message string — guarantees the error UI always has copy to show. */
interface HeroErrorState {
  hasError: boolean;
  message: string;
}

const typeSpeed = 40;
const subSpeed = 30;

const HeroSection: React.FC<HeroSectionProps> = ({ className, router: routerProp }) => {
  const router = routerProp ?? useRouter();
  const { t } = useTranslation("common");
  const { fire } = useHeroTelemetry();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [error, setError] = useState<HeroErrorState>({ hasError: false, message: "" });

  // #826: observe CLS / LCP against the "Good" Web Vitals budget
  useHeroPerformanceBudget();

  // SW-3: fire hero_view once on mount
  useEffect(() => {
    trackHeroViewed();
  }, [trackHeroViewed]);

  // SW-FE-005: Error boundary for navigation failures
  const handleTrackedNavigation = useCallback(
    (cta: "continue_game" | "multiplayer" | "join_room" | "challenge_ai", destination: string) => {
      try {
        trackCtaClicked(cta, destination);
        router.push(destination);
      } catch (err) {
        const sanitized = sanitizeError(err);
        setError({ hasError: true, message: sanitized.userMessage });
      }
    },
    [trackCtaClicked, router],
  );

  // SW-FE-005: Show a friendly message when navigation fails
  if (error.hasError) {
    return (
      <section
        aria-label={t(HERO_I18N.aria.heroSection)}
        role="alert"
        className={`z-0 w-full lg:h-screen md:h-[calc(100vh-87px)] h-screen relative overflow-x-hidden md:mb-20 mb-10 bg-[#010F10] flex items-center justify-center ${className ?? ""}`}
      >
        <div className="text-center px-4">
          <p className="font-orbitron text-[#00F0FF] text-[20px] md:text-[28px] font-[700] mb-4">
            {t(HERO_I18N.error.heading)}
          </p>
          <p className="font-dmSans text-[#F0F7F7] text-[14px] md:text-[16px] mb-6">
            {error.message}
          </p>
          <button
            onClick={() => {
              setError({ hasError: false, message: "" });
              trackHeroViewed();
            }}
            className="font-orbitron text-[#010F10] bg-[#00F0FF] px-6 py-3 rounded-lg font-[700] text-[14px] hover:opacity-90 transition-opacity"
            aria-label={t(HERO_I18N.error.tryAgain)}
          >
            {t(HERO_I18N.error.tryAgain)}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label={t(HERO_I18N.aria.heroSection)}
      className={`z-0 w-full lg:h-screen md:h-[calc(100vh-87px)] h-screen relative overflow-x-hidden md:mb-20 mb-10 bg-[#010F10] ${className || ""}`}
    >
      {/* Background gradient */}
      <div
        aria-hidden="true"
        className="w-full h-full overflow-hidden bg-cover bg-center"
        style={{
          background: "linear-gradient(135deg, #010F10 0%, #0a2a2d 50%, #010F10 100%)",
        }}
      />

      {/* Large Background TYCOON Text — decorative only */}
      <div aria-hidden="true" className="w-full h-auto absolute top-0 left-0 flex items-center justify-center">
        <p className="text-center uppercase font-kronaOne font-normal text-transparent big-hero-text w-full text-[40px] sm:text-[40px] md:text-[80px] lg:text-[135px] relative before:absolute before:content-[''] before:w-full before:h-full before:bg-gradient-to-b before:from-transparent lg:before:via-[#010F10]/80 before:to-[#010F10] before:top-0 before:left-0 before:z-1">
          TYCOON
        </p>
      </div>

      <div className="absolute left-0 top-0 z-2 flex h-full w-full flex-col items-center gap-1 bg-transparent lg:justify-center">
        {/* Welcome Message */}
        <div className="mt-20 md:mt-28 lg:mt-0">
          <p className="font-orbitron lg:text-[24px] md:text-[20px] text-[16px] font-[700] text-[#00F0FF] text-center">
            {t(HERO_I18N.welcome)}
          </p>
        </div>

        {/* Animated Tagline */}
        <div
          aria-live="polite"
          aria-atomic="true"
          className="flex min-h-[30px] md:min-h-[44px] lg:min-h-[56px] justify-center items-center md:gap-6 gap-3 mt-4 md:mt-6 lg:mt-4"
        >
          <TypeAnimation
            sequence={[
              t(HERO_I18N.tagline.conquer),
              1200,
              t(HERO_I18N.tagline.conquerBuild),
              1200,
              t(HERO_I18N.tagline.conquerBuildTradeOn),
              1800,
              t(HERO_I18N.tagline.playSoloVsAI),
              2000,
              t(HERO_I18N.tagline.conquerBuild),
              1000,
              t(HERO_I18N.tagline.conquer),
              1000,
            ]}
            wrapper="span"
            speed={typeSpeed}
            repeat={prefersReducedMotion ? 1 : Infinity}
            preRenderFirstString
            className="font-orbitron lg:text-[40px] md:text-[30px] text-[20px] font-[700] text-[#F0F7F7] text-center block"
          />
        </div>

        {/* Main Title — single h1 on this page */}
        <h1
          data-testid="hero-main-title"
          data-lcp="true"
          className="block-text font-[900] font-orbitron lg:text-[116px] md:text-[98px] text-[54px] lg:leading-[120px] md:leading-[100px] leading-[60px] tracking-[-0.02em] uppercase text-[#17ffff] relative"
        >
          {t(HERO_I18N.title.main)}
          <span
            aria-hidden="true"
            className={`absolute top-0 left-[69%] text-[#0FF0FC] font-dmSans font-[700] md:text-[27px] text-[18px] rotate-12 ${!prefersReducedMotion ? "animate-pulse" : ""}`}
          >
            {t(HERO_I18N.title.decorative)}
          </span>
        </h1>

        {/* Description + Animated Sub-text */}
        <div className="w-full px-4 md:w-[70%] lg:w-[55%] text-center text-[#F0F7F7] -tracking-[2%]">
          <div
            aria-live="polite"
            aria-atomic="true"
            className="min-h-[30px] md:min-h-[44px] lg:min-h-[56px]"
          >
            <TypeAnimation
              sequence={[
                t(HERO_I18N.subtitle.rollTheDice),
                2000,
                t(HERO_I18N.subtitle.buyProperties),
                2000,
                t(HERO_I18N.subtitle.collectRent),
                2000,
                t(HERO_I18N.subtitle.playAgainstAI),
                2200,
                t(HERO_I18N.subtitle.becomeTopTycoon),
                2000,
              ]}
              wrapper="span"
              speed={subSpeed}
              repeat={prefersReducedMotion ? 1 : Infinity}
              preRenderFirstString
              className="font-orbitron lg:text-[40px] md:text-[30px] text-[20px] font-[700] text-[#F0F7F7] text-center block"
            />
          </div>
          <p className="font-dmSans font-[400] md:text-[18px] text-[14px] text-[#F0F7F7] mt-4">
            {t(HERO_I18N.description)}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="z-1 w-full flex flex-col justify-center items-center mt-6 gap-4">
          {/* Continue Game */}
          <button
            data-testid="hero-primary-cta"
            aria-label={t(HERO_I18N.buttons.continueGame)}
            onClick={() => handleTrackedNavigation("continue_game_click", "/game-settings")}
            className="relative group w-[300px] h-[56px] bg-transparent border-none p-0 overflow-hidden cursor-pointer transition-transform group-hover:scale-105"
          >
            <svg
              aria-hidden="true"
              width="300"
              height="56"
              viewBox="0 0 300 56"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={`absolute top-0 left-0 w-full h-full transform scale-x-[-1] ${!prefersReducedMotion ? "group-hover:animate-pulse" : ""}`}
            >
              <path
                d="M12 1H288C293.373 1 296 7.85486 293.601 12.5127L270.167 54.5127C269.151 56.0646 267.42 57 265.565 57H12C8.96244 57 6.5 54.5376 6.5 51.5V9.5C6.5 6.46243 8.96243 4 12 4Z"
                fill="#00F0FF"
                stroke="#0E282A"
                strokeWidth={2}
              />
            </svg>
            <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-[#010F10] text-[20px] font-orbitron font-[700] z-2">
              <Gamepad2 className="mr-2 w-7 h-7" />
              {t(HERO_I18N.buttons.continueGame)}
            </span>
          </button>

          {/* Multiplayer */}
          <button
            aria-label={t(HERO_I18N.buttons.multiplayer)}
            onClick={() => handleTrackedNavigation("multiplayer_click", "/game-settings")}
            className="relative group w-[227px] h-[40px] bg-transparent border-none p-0 overflow-hidden cursor-pointer"
          >
            <svg
              aria-hidden="true"
              width="227"
              height="40"
              viewBox="0 0 227 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={`absolute top-0 left-0 w-full h-full transform scale-x-[-1] scale-y-[-1] ${!prefersReducedMotion ? "group-hover:stroke-[#00F0FF] transition-all duration-300" : ""}`}
            >
              <path
                d="M6 1H221C225.373 1 227.996 5.85486 225.601 9.5127L207.167 37.5127C206.151 39.0646 204.42 40 202.565 40H6C2.96244 40 0.5 37.5376 0.5 34.5V6.5C0.5 3.46243 2.96243 1 6 1Z"
                fill="#003B3E"
                stroke="#003B3E"
                strokeWidth={1}
                className={`${!prefersReducedMotion ? "group-hover:stroke-[#00F0FF] transition-all duration-300" : ""}`}
              />
            </svg>
            <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-[#00F0FF] capitalize text-[12px] font-dmSans font-medium z-2">
              <Gamepad2 className="mr-1.5 w-[16px] h-[16px]" />
              {t(HERO_I18N.buttons.multiplayer)}
            </span>
          </button>

          {/* Join Room */}
          <button
            aria-label={t(HERO_I18N.buttons.joinRoom)}
            onClick={() => handleTrackedNavigation("join_room_click", "/join-room")}
            className="relative group w-[140px] h-[40px] bg-transparent border-none p-0 overflow-hidden cursor-pointer"
          >
            <svg
              aria-hidden="true"
              width="140"
              height="40"
              viewBox="0 0 140 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={`absolute top-0 left-0 w-full h-full ${!prefersReducedMotion ? "group-hover:stroke-[#00F0FF] transition-all duration-300" : ""}`}
            >
              <path
                d="M6 1H134C138.373 1 140.996 5.85486 138.601 9.5127L120.167 37.5127C119.151 39.0646 117.42 40 115.565 40H6C2.96244 40 0.5 37.5376 0.5 34.5V6.5C0.5 3.46243 2.96243 1 6 1Z"
                fill="#0E1415"
                stroke="#003B3E"
                strokeWidth={1}
                className={`${!prefersReducedMotion ? "group-hover:stroke-[#00F0FF] transition-all duration-300" : ""}`}
              />
            </svg>
            <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-[#0FF0FC] capitalize text-[12px] font-dmSans font-medium z-2">
              <Dices className="mr-1.5 w-[16px] h-[16px]" />
              {t(HERO_I18N.buttons.joinRoom)}
            </span>
          </button>

          {/* Challenge AI */}
          <button
            aria-label={t(HERO_I18N.buttons.challengeAI)}
            onClick={() => handleTrackedNavigation("challenge_ai_click", "/play-ai")}
            className="relative group w-[260px] h-[52px] bg-transparent border-none p-0 overflow-hidden cursor-pointer transition-transform duration-300 group-hover:scale-105"
          >
            <svg
              aria-hidden="true"
              width="260"
              height="52"
              viewBox="0 0 260 52"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={`absolute top-0 left-0 w-full h-full transform scale-x-[-1] ${!prefersReducedMotion ? "group-hover:animate-pulse" : ""}`}
            >
              <path
                d="M10 1H250C254.373 1 256.996 6.85486 254.601 10.5127L236.167 49.5127C235.151 51.0646 233.42 52 231.565 52H10C6.96244 52 4.5 49.5376 4.5 46.5V9.5C4.5 6.46243 6.96243 4 10 4Z"
                fill="#00F0FF"
                stroke="#0E282A"
                strokeWidth={1}
              />
            </svg>
            <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-[#010F10] uppercase text-[16px] -tracking-[2%] font-orbitron font-[700] z-2">
              {t(HERO_I18N.buttons.challengeAI)}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
