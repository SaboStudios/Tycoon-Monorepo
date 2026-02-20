"use client";

import { Dices, Gamepad2, Bot } from "lucide-react";
import { useRouter } from "next/navigation";

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
export default function HeroSectionMobile() {
  const router = useRouter();

  const ctaBase =
    "min-h-[48px] min-w-[48px] flex items-center justify-center gap-2 font-orbitron font-[700] rounded-xl transition-transform active:scale-95 touch-manipulation";

  return (
    <section className="z-0 w-full min-h-[calc(100dvh-87px)] relative overflow-x-hidden py-8 px-4 bg-[#010F10]">
      {/* Simplified background: flat gradient */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background:
            "linear-gradient(180deg, #010F10 0%, #0a1f21 40%, #010F10 100%)",
        }}
        aria-hidden
      />

      <main className="relative z-10 flex flex-col items-center gap-6 text-center max-w-md mx-auto">
        {/* Welcome */}
        <p className="text-[14px] font-orbitron font-[700] text-[#00F0FF]">
          Welcome back, Player!
        </p>

        {/* Title - stacked, smaller */}
        <h1 className="font-orbitron font-[900] text-[36px] leading-[42px] tracking-tight uppercase text-[#17ffff]">
          TYCOON
          <span className="ml-1 text-[16px] text-[#0FF0FC] rotate-12 animate-pulse inline-block">
            ?
          </span>
        </h1>

        {/* Tagline - condensed */}
        <p className="font-orbitron text-[16px] font-[700] text-[#F0F7F7]">
          Conquer • Build • Trade On
        </p>

        {/* Description */}
        <p className="font-dmSans text-[14px] text-[#F0F7F7]/90 leading-relaxed">
          Step into Tycoon — the Web3 twist on the classic game. Play solo vs
          AI, compete in multiplayer, and become the ultimate tycoon.
        </p>

        {/* Stacked CTAs - touch-friendly (min 48px) */}
        <div className="w-full flex flex-col gap-3 mt-2">
          <button
            onClick={() => router.push("/game-settings")}
            className={`w-full ${ctaBase} bg-[#00F0FF] text-[#010F10] text-[16px] py-4`}
            aria-label="Continue game"
          >
            <Gamepad2 className="w-6 h-6 shrink-0" />
            Continue Game
          </button>

          <button
            onClick={() => router.push("/game-settings")}
            className={`w-full ${ctaBase} border-2 border-[#00F0FF] text-[#00F0FF] text-[14px] py-3`}
            aria-label="Multiplayer"
          >
            <Gamepad2 className="w-5 h-5 shrink-0" />
            Multiplayer
          </button>

          <button
            onClick={() => router.push("/join-room")}
            className={`w-full ${ctaBase} border-2 border-[#003B3E] text-[#0FF0FC] text-[14px] py-3`}
            aria-label="Join room"
          >
            <Dices className="w-5 h-5 shrink-0" />
            Join Room
          </button>

          <button
            onClick={() => router.push("/play-ai")}
            className={`w-full ${ctaBase} bg-[#00F0FF] text-[#010F10] text-[14px] py-4 uppercase tracking-wide`}
            aria-label="Challenge AI"
          >
            <Bot className="w-5 h-5 shrink-0" />
            Challenge AI!
          </button>
        </div>
      </main>
    </section>
  );
}
