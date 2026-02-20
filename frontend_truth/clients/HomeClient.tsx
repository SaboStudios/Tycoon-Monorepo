// components/HomeClient.tsx
"use client";

import { useMediaQuery } from "@/components/useMediaQuery";
import HeroSection from "@/components/guest/HeroSection";
import HeroSectionMobile from "@/components/guest/HeroSection-mobile";
import WhatIsTycoon from "@/components/guest/WhatIsTycoon";
import HowItWorks from "@/components/guest/HowItWorks";
import JoinOurCommunity from "@/components/guest/JoinOurCommunity";
import Footer from "@/components/shared/Footer";

export default function HomeClient() {
  const isMobile = useMediaQuery("(max-width: 768px)");

  return (
    <main className="w-full">
      {isMobile ? <HeroSectionMobile /> : <HeroSection />}
      <WhatIsTycoon />
      <HowItWorks />
      <JoinOurCommunity />
      <Footer />
    </main>
  );
}