"use client"; // ← Mark as client component

import { useMediaQuery } from "@/components/useMediaQuery"; // Your custom hook
import NavBar from "@/components/shared/navbar";
import NavBarMobile from "@/components/shared/navbar-mobile";
import { ReactNode, useEffect, useState } from "react";
import { dmSans, kronaOne, orbitron } from "@/components/shared/fonts"; // Adjust path if needed
import { ProfileProvider } from "@/context/ProfileContext";

interface ClientLayoutProps {
  children: ReactNode;
  cookies?: string | null;
}

export default function ClientLayout({ children, cookies }: ClientLayoutProps) {
  const [isClient, setIsClient] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Hydration safety: Wait for client mount before rendering dynamic content
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Suppress hydration warning by rendering nothing until client is ready
  if (!isClient) {
    return (
      <div suppressHydrationWarning className={`${orbitron.variable} ${dmSans.variable} ${kronaOne.variable}`}>
        {children}
      </div>
    );
  }

  return (
    <ProfileProvider>
      <div suppressHydrationWarning className={`${orbitron.variable} ${dmSans.variable} ${kronaOne.variable}`}>
        {isMobile ? <NavBarMobile /> : <NavBar />}
        {children}
      </div>
    </ProfileProvider>
  );
}