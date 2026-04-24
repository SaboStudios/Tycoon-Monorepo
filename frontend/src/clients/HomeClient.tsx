// components/HomeClient.tsx
"use client";

import dynamic from "next/dynamic";
import HeroSection from "@/components/guest/HeroSection";
import HeroSectionMobile from "@/components/guest/HeroSectionMobile";

const WhatIsTycoon = dynamic(() => import("@/components/guest/WhatIsTycoon"), {
  ssr: false,
  loading: () => <div aria-hidden className="h-[520px] w-full bg-[#010F10]" />,
});
const HowItWorks = dynamic(() => import("@/components/guest/HowItWorks"), {
  ssr: false,
  loading: () => <div aria-hidden className="h-[420px] w-full bg-[#010F10]" />,
});
const JoinOurCommunity = dynamic(() => import("@/components/guest/JoinOurCommunity"), {
  ssr: false,
  loading: () => <div aria-hidden className="h-[360px] w-full bg-[#010F10]" />,
});

export default function HomeClient() {
  return (
    <div className="w-full">
      <div className="md:hidden">
        <HeroSectionMobile />
      </div>
      <div className="hidden md:block">
        <HeroSection />
      </div>
      <WhatIsTycoon />
      <HowItWorks />
      <JoinOurCommunity />
    </div>
  );
}