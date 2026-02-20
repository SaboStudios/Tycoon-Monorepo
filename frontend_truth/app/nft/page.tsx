// app/generate-perk-cards/page.tsx
"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Zap, Crown, Coins, Sparkles, Gem, Shield, X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const perks = [
  { id: 1, name: "Extra Turn", icon: <Zap className="w-20 h-20" />, color: "from-yellow-500 to-amber-600", glow: "#fCD34D" },
  { id: 2, name: "Jail Free Card", icon: <Crown className="w-20 h-20" />, color: "from-purple-600 to-pink-600", glow: "#C084FC" },
  { id: 3, name: "Double Rent", icon: <Coins className="w-20 h-20" />, color: "from-green-600 to-emerald-600", glow: "#34D399" },
  { id: 4, name: "Roll Boost", icon: <Sparkles className="w-20 h-20" />, color: "from-blue-600 to-cyan-600", glow: "#22D3EE" },
  { id: 5, name: "Instant Cash", icon: <Gem className="w-20 h-20" />, color: "from-cyan-600 to-teal-600", glow: "#2DD4BF" },
  { id: 6, name: "Teleport", icon: <Zap className="w-20 h-20" />, color: "from-pink-600 to-rose-600", glow: "#F472B6" },
  { id: 7, name: "Shield", icon: <Shield className="w-20 h-20" />, color: "from-indigo-600 to-blue-600", glow: "#60A5FA" },
  { id: 8, name: "Property Discount", icon: <Coins className="w-20 h-20" />, color: "from-orange-600 to-red-600", glow: "#FB923C" },
  { id: 9, name: "Tax Refund", icon: <Gem className="w-20 h-20" />, color: "from-teal-600 to-cyan-500", glow: "#5EEAD4" },
  { id: 10, name: "Exact Roll", icon: <Sparkles className="w-20 h-20" />, color: "from-amber-600 to-yellow-500", glow: "#FBBF24" },
];

export default function PerkCardsGenerator() {
  const [selectedPerk, setSelectedPerk] = useState<typeof perks[0] | null>(null);

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-[#010F10] via-[#05191a] to-[#010F10] py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-center text-5xl md:text-6xl font-black uppercase text-transparent bg-clip-text bg-gradient-to-b from-[#00F0FF] to-[#0FF0FC] mb-16">
            Tycoon Perk Cards Generator
          </h1>

          <p className="text-center text-[#F0F7F7] text-xl mb-12 max-w-3xl mx-auto">
            Click any card to open a full-size popup — perfect for screenshotting your shop images!
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
            {perks.map((perk) => (
              <motion.button
                key={perk.id}
                whileHover={{ scale: 1.08, y: -10 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedPerk(perk)}
                className="group relative bg-[#0E1415]/90 backdrop-blur-md rounded-2xl overflow-hidden border-2 border-[#003B3E] hover:border-[#00F0FF] transition-all duration-500 shadow-xl"
              >
                {/* Card Glow Border */}
                <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-60 transition-opacity duration-700 bg-gradient-to-br ${perk.color} blur-xl`} />

                <div className="relative p-8 flex flex-col items-center gap-6">
                  {/* Icon Circle */}
                  <div className={`w-40 h-40 rounded-full bg-gradient-to-br ${perk.color} p-6 shadow-2xl`}>
                    <div className="w-full h-full rounded-full bg-[#010F10]/90 flex items-center justify-center border-4 border-white/20">
                      <div className="text-white">{perk.icon}</div>
                    </div>
                  </div>

                  {/* Name */}
                  <h3 className="text-2xl font-bold text-[#F0F7F7] tracking-wide">
                    {perk.name}
                  </h3>

                  {/* Hover Pulse Glow */}
                  <div className="absolute inset-0 rounded-2xl">
                    <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${perk.color} opacity-0 group-hover:opacity-30 animate-pulse`} />
                  </div>
                </div>
              </motion.button>
            ))}
          </div>

          <div className="text-center mt-16 text-gray-400">
            <p>Total: {perks.length} Perks • Click to enlarge • Screenshot ready</p>
          </div>
        </div>
      </div>

      {/* Full-Size Popup Modal */}
      <AnimatePresence>
        {selectedPerk && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPerk(null)}
              className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-8"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="fixed z-50 max-w-3xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative bg-[#0E1415]/95 backdrop-blur-xl rounded-3xl border-4 border-[#003B3E] shadow-2xl overflow-hidden">
                {/* Close Button */}
                <button
                  onClick={() => setSelectedPerk(null)}
                  className="absolute top-6 right-6 z-10 text-gray-400 hover:text-white transition"
                >
                  <X className="w-10 h-10" />
                </button>

                {/* Full Card Content - Screenshot Ready */}
                <div className="w-[600px] h-[800px] mx-auto flex flex-col items-center justify-center gap-16 py-20 px-12 relative overflow-hidden">
                  {/* Background Glow */}
                  <div className="absolute inset-0 opacity-30">
                    <div className="absolute top-[-30%] left-[-30%] w-full h-full bg-cyan-600 rounded-full blur-[180px]" />
                    <div className="absolute bottom-[-30%] right-[-30%] w-full h-full bg-teal-600 rounded-full blur-[180px]" />
                  </div>

                  {/* Pulsing Border Glow */}
                  <div className={`absolute inset-0 rounded-3xl opacity-60 animate-pulse bg-gradient-to-br ${selectedPerk.color} blur-2xl`} />

                  {/* Icon */}
                  <div className="relative">
                    <div className={`w-80 h-80 rounded-full bg-gradient-to-br ${selectedPerk.color} p-10 shadow-2xl`}>
                      <div className="w-full h-full rounded-full bg-[#010F10]/90 flex items-center justify-center border-8 border-white/20">
                        <div className="text-white scale-150">{selectedPerk.icon}</div>
                      </div>
                    </div>
                    <div className="absolute inset-0 rounded-full blur-3xl opacity-70 scale-110 -z-10" style={{ backgroundColor: selectedPerk.glow }} />
                  </div>

                  {/* Name */}
                  <h1 className="text-7xl font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-b from-white to-[#B0BFC0] drop-shadow-2xl">
                    {selectedPerk.name}
                  </h1>

                  {/* Tip */}
                  <p className="absolute bottom-10 text-gray-400 text-lg font-medium">
                    Screenshot this card for your shop image!
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}