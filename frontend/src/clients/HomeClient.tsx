// components/HomeClient.tsx
"use client";

import HeroSection from "@/components/guest/HeroSection";
import HeroSectionMobile from "@/components/guest/HeroSectionMobile";
import WhatIsTycoon from "@/components/guest/WhatIsTycoon";
import HowItWorks from "@/components/guest/HowItWorks";
import JoinOurCommunity from "@/components/guest/JoinOurCommunity";
import Footer from "@/components/shared/Footer";

export default function HomeClient() {
  return (
    <main className="w-full">
      <div className="md:hidden">
        <HeroSectionMobile />
      </div>
      <div className="hidden md:block">
        <HeroSection />
      </div>
      <WhatIsTycoon />
      <HowItWorks />
      <JoinOurCommunity />
      <Footer />
    </main>
  );
}