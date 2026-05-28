"use client";

import { Dices, Gamepad2, Bot } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { HERO_I18N } from "@/lib/hero/i18n-keys";

interface HeroSectionMobileProps {
  className?: string | undefined;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);

    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/**
 * Mobile-responsive hero section for Tycoon.
 *
 * Usage:
 * - Use with useMediaQuery: render HeroSectionMobile when (window.innerWidth < 768)
 * - Or use conditional render in parent: {isMobile ? <HeroSectionMobile /> : <HeroSection />}
 * - Or rely on CSS: show/hide with md:hidden / hidden md:block on wrapper divs
 *
 * @example
 * ```tsx
 * const isMobile = useMediaQuery('(max-width: 767px)');
 * return isMobile ? <HeroSectionMobile /> : <HeroSection />;
 * ```
 *
 * @example
 * ```tsx
 * <div className="md:hidden"><HeroSectionMobile /></div>
 * <div className="hidden md:block"><HeroSection /></div>
 * ```
 */
export default function HeroSectionMobile({ className }: HeroSectionMobileProps): React.ReactElement {
  const router = useRouter();
  const { t } = useTranslation("common");
  const prefersReducedMotion = usePrefersReducedMotion();

  const ctaBase =
    "min-h-[48px] min-w-[48px] flex items-center justify-center gap-2 font-orbitron font-[700] rounded-xl transition-transform active:scale-95 touch-manipulation";

  const handleTrackedNavigation = (
    event: "continue_game_click" | "multiplayer_click" | "join_room_click" | "challenge_ai_click",
    destination: string,
  ): void => {
    track(event, {
      route: "/",
      destination,
    });

    router.push(destination);
  }

  return (
    <section className={`z-0 w-full min-h-[calc(100dvh-87px)] relative overflow-x-hidden py-8 px-4 bg-[#010F10] ${className || ""}`}>
      {/* Simplified background: flat gradient */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background:
            "linear-gradient(180deg, #010F10 0%, #0a1f21 40%, #010F10 100%)",
        }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex max-w-md flex-col items-center gap-6 text-center">
        {/* Welcome */}
        <p className="text-[14px] font-orbitron font-[700] text-[#00F0FF]">
          {t(HERO_I18N.welcome)}
        </p>

        {/* Title - stacked, smaller */}
        <h1 className="min-h-[42px] font-orbitron font-[900] text-[36px] leading-[42px] tracking-tight uppercase text-[#17ffff]">
          {t(HERO_I18N.title.main)}
          <span
            aria-hidden="true"
            className={`ml-1 text-[16px] text-[#0FF0FC] rotate-12 inline-block ${!prefersReducedMotion ? "animate-pulse" : ""}`}
          >
            {t(HERO_I18N.title.decorative)}
          </span>
        </h1>

        {/* Tagline - condensed */}
        <p className="min-h-[24px] font-orbitron text-[16px] font-[700] text-[#F0F7F7]">
          {t(HERO_I18N.tagline.conquerBuildTradeOn)}
        </p>

        {/* Description */}
        <p className="font-dmSans text-[14px] text-[#F0F7F7]/90 leading-relaxed">
          {t(HERO_I18N.description)}
        </p>

        {/* Stacked CTAs - touch-friendly (min 48px) */}
        <div className="w-full flex flex-col gap-3 mt-2">
          <button
            onClick={() => handleTrackedNavigation("continue_game_click", "/game-settings")}
            className={`w-full ${ctaBase} bg-[#00F0FF] text-[#010F10] text-[16px] py-4`}
            aria-label={t(HERO_I18N.buttons.continueGame)}
          >
            <Gamepad2 className="w-6 h-6 shrink-0" />
            {t(HERO_I18N.buttons.continueGame)}
          </button>

          <button
            onClick={() => handleTrackedNavigation("multiplayer_click", "/game-settings")}
            className={`w-full ${ctaBase} border-2 border-[#00F0FF] text-[#00F0FF] text-[14px] py-3`}
            aria-label={t(HERO_I18N.buttons.multiplayer)}
          >
            <Gamepad2 className="w-5 h-5 shrink-0" />
            {t(HERO_I18N.buttons.multiplayer)}
          </button>

          <button
            onClick={() => handleTrackedNavigation("join_room_click", "/join-room")}
            className={`w-full ${ctaBase} border-2 border-[#003B3E] text-[#0FF0FC] text-[14px] py-3`}
            aria-label={t(HERO_I18N.buttons.joinRoom)}
          >
            <Dices className="w-5 h-5 shrink-0" />
            {t(HERO_I18N.buttons.joinRoom)}
          </button>

          <button
            onClick={() => handleTrackedNavigation("challenge_ai_click", "/play-ai")}
            className={`w-full ${ctaBase} bg-[#00F0FF] text-[#010F10] text-[14px] py-4 uppercase tracking-wide`}
            aria-label={t(HERO_I18N.buttons.challengeAI)}
          >
            <Bot className="w-5 h-5 shrink-0" />
            {t(HERO_I18N.buttons.challengeAI)}
          </button>
        </div>
      </div>
    </section>
  );
}
