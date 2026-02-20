"use client"; // Marks this as a Client Component

import { sdk } from '@farcaster/miniapp-sdk';
import { useEffect } from "react";

export default function FarcasterReady() {
  useEffect(() => {
    sdk.actions.ready();
  }, []);

  return null; // This component doesn't need to render anything visible
}