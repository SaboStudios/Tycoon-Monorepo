// components/HomeClient.tsx
"use client";

import dynamic from "next/dynamic";

const HeroSection = dynamic(() => import("@/components/guest/HeroSection"));
const HeroSectionMobile = dynamic(() => import("@/components/guest/HeroSectionMobile"));
const WhatIsTycoon = dynamic(() => import("@/components/guest/WhatIsTycoon"));
const HowItWorks = dynamic(() => import("@/components/guest/HowItWorks"));
const JoinOurCommunity = dynamic(() => import("@/components/guest/JoinOurCommunity"));

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