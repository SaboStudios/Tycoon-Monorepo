"use client";

import ProfilePage from "@/components/profile/profile";
import ProfilePageMobile from "@/components/profile/profile-mobile";
import { useMediaQuery } from "@/components/useMediaQuery";


export default function ProfileClient() {
  const isMobile = useMediaQuery("(max-width: 768px)");

  return (
    <main className="w-full">
      {isMobile ? <ProfilePageMobile /> : <ProfilePage />}
    </main>
  );
}