"use client";

import { useEffect } from "react";
import type { Socket } from "socket.io-client";
import {
  createBoostSocket,
  getBoostSocketToken,
  isBoostSocketEnabled,
} from "@/lib/socket/boostSocket";

/**
 * Establishes the live perks/boosts socket connection on the game-play page.
 * Boost events are re-dispatched as window CustomEvents for the game board UI.
 */
export default function BoostSocketListener() {
  useEffect(() => {
    if (!isBoostSocketEnabled()) return;

    const token = getBoostSocketToken();
    if (!token) {
      if (process.env.NODE_ENV !== "production") {
        console.debug("[BoostSocket] no access token; skipping connection");
      }
      return;
    }

    const socket: Socket = createBoostSocket(token, {
      onBoostActivated: (data) => {
        console.debug("[BoostSocket] boost.activated", data);
        window.dispatchEvent(
          new CustomEvent("tycoon:boost.activated", { detail: data })
        );
      },
      onBoostExpired: (data) => {
        console.debug("[BoostSocket] boost.expired", data);
        window.dispatchEvent(
          new CustomEvent("tycoon:boost.expired", { detail: data })
        );
      },
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return null;
}
