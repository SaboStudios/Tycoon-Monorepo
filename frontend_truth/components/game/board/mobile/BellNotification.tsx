"use client";

import { motion } from "framer-motion";
import { Bell } from "lucide-react";

interface BellNotificationProps {
  bellFlash: boolean;
  incomingCount: number;
}

export default function BellNotification({ bellFlash, incomingCount }: BellNotificationProps) {
  return (
    <div className="fixed top-4 right-20 z-50 flex items-center">
      <motion.button
        animate={bellFlash ? { rotate: [0, -20, 20, -20, 20, 0] } : { rotate: 0 }}
        transition={{ duration: 0.6 }}
        onClick={() => {
          // Only purple trade notification is shown; no toast on bell click
        }}
        className="relative p-3 bg-purple-700/80 backdrop-blur-md rounded-full shadow-lg hover:bg-purple-600 transition"
      >
        <Bell className="w-7 h-7 text-white" />
        {incomingCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse">
            {incomingCount}
          </span>
        )}
      </motion.button>
    </div>
  );
}
