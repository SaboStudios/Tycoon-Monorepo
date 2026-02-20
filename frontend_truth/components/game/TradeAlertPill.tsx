"use client";

import { motion } from "framer-motion";
import { Bell } from "lucide-react";

interface TradeAlertPillProps {
  incomingCount: number;
  onViewTrades?: () => void;
  newTradePulse?: boolean;
}

export default function TradeAlertPill({
  incomingCount,
  onViewTrades,
  newTradePulse = false,
}: TradeAlertPillProps) {
  if (incomingCount === 0) return null;

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{
        opacity: 1,
        scale: newTradePulse ? [1, 1.08, 1] : 1,
      }}
      transition={{
        opacity: { duration: 0.2 },
        scale: { duration: 0.25 },
      }}
      onClick={onViewTrades}
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-violet-500/50 bg-gradient-to-br from-violet-800/95 to-fuchsia-800/95 shadow-lg shadow-violet-900/40 backdrop-blur-sm transition hover:border-violet-400/60 active:scale-95"
      aria-label={`${incomingCount} trade offer${incomingCount === 1 ? "" : "s"}`}
    >
      <Bell className="h-5 w-5 text-violet-200" />
      <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-xs font-bold text-white shadow ring-2 ring-[#010F10]">
        {incomingCount > 99 ? "99+" : incomingCount}
      </span>
    </motion.button>
  );
}
