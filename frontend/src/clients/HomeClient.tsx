// components/HomeClient.tsx
"use client";

import HeroSection from "@/components/guest/HeroSection";
import WhatIsTycoon from "@/components/guest/WhatIsTycoon";
import HowItWorks from "@/components/guest/HowItWorks";
import JoinOurCommunity from "@/components/guest/JoinOurCommunity";
import Footer from "@/components/shared/Footer";

export default function HomeClient() {
  return (
    <main className="w-full">
      <HeroSection />
      <WhatIsTycoon />
      <HowItWorks />
      <JoinOurCommunity />
      <Footer />
    </main>
  );
}