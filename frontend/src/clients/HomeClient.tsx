// components/HomeClient.tsx
"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import HeroSection from "@/components/guest/HeroSection";
import HeroSectionMobile from "@/components/guest/HeroSectionMobile";

/**
 * Loading placeholder for dynamic sections with proper accessibility support
 */
const loadingPlaceholder = (height: string): ReactNode => (
  <div aria-hidden="true" className={`w-full bg-[#010F10] ${height}`} />
);

const WhatIsTycoon = dynamic(() => import("@/components/guest/WhatIsTycoon"), {
  ssr: false,
  loading: () => loadingPlaceholder("h-[520px]"),
});

const HowItWorks = dynamic(() => import("@/components/guest/HowItWorks"), {
  ssr: false,
  loading: () => loadingPlaceholder("h-[420px]"),
});

const JoinOurCommunity = dynamic(() => import("@/components/guest/JoinOurCommunity"), {
  ssr: false,
  loading: () => loadingPlaceholder("h-[360px]"),
});

/**
 * HomeClient Component
 * 
 * Renders the home page content with responsive layout and dynamic section loading.
 * Manages mobile/desktop variants and handles graceful loading states.
 * 
 * @returns {ReactNode} The rendered home page component
 */
export default function HomeClient(): ReactNode {
  // Ensure components are defined before rendering
  if (!WhatIsTycoon || !HowItWorks || !JoinOurCommunity) {
    return (
      <div className="w-full bg-[#010F10] p-4 text-center text-red-500">
        Error loading home page components
      </div>
    );
  }

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