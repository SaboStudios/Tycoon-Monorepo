"use client";

import React from "react";
import { FaUser, FaRobot, FaBrain, FaCoins } from "react-icons/fa6";
import { House } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/game-switch";
import { RiAuctionFill } from "react-icons/ri";
import { GiPrisoner, GiBank } from "react-icons/gi";
import { IoBuild } from "react-icons/io5";
import { FaRandom } from "react-icons/fa";
import { useRouter } from "next/navigation";
import { GamePieces } from "@/lib/constants/games";
import { ShieldCheck } from "lucide-react";
import { useAIGameCreate } from "@/hooks/useAIGameCreate";

export default function PlayWithAI() {
  const router = useRouter();
  const {
    settings,
    setSettings,
    handlePlay,
    canCreate,
    isCreatePending,
    isGuest,
    isRegisteredLoading,
    registeredAgents,
    agentsLoading,
    registrySupported,
  } = useAIGameCreate();

  if (!isGuest && isRegisteredLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-settings bg-cover">
        <p className="text-[#00F0FF] text-4xl font-orbitron animate-pulse tracking-wider">
          LOADING ARENA...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-settings bg-cover bg-fixed flex items-center justify-center p-6">
      <div className="w-full max-w-5xl bg-black/80 backdrop-blur-3xl rounded-3xl border border-cyan-500/30 shadow-2xl p-8 md:p-12">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-3 text-cyan-400 hover:text-cyan-300 transition group"
          >
            <House className="w-6 h-6 group-hover:-translate-x-1 transition" />
            <span className="font-bold text-lg">BACK</span>
          </button>
          <h1 className="text-5xl font-orbitron font-extrabold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
            AI DUEL
          </h1>
          <div className="w-24" />
        </div>

        {/* Main Grid - Desktop layout */}
        <div className="grid lg:grid-cols-3 gap-8 mb-10">
          {/* Column 1 */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-cyan-900/40 to-blue-900/40 rounded-2xl p-6 border border-cyan-500/30">
              <div className="flex items-center gap-3 mb-4">
                <FaUser className="w-7 h-7 text-cyan-400" />
                <h3 className="text-xl font-bold text-cyan-300">Your Piece</h3>
              </div>
              <Select value={settings.symbol} onValueChange={(v) => setSettings((p) => ({ ...p, symbol: v }))}>
                <SelectTrigger className="h-14 bg-black/60 border-cyan-500/40 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GamePieces.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 rounded-2xl p-6 border border-purple-500/30">
              <div className="flex items-center gap-3 mb-4">
                <FaRobot className="w-7 h-7 text-purple-400" />
                <h3 className="text-xl font-bold text-purple-300">AI Opponents</h3>
              </div>
              <Select
                value={settings.aiCount.toString()}
                onValueChange={(v) => setSettings((p) => ({ ...p, aiCount: +v }))}
              >
                <SelectTrigger className="h-14 bg-black/60 border-purple-500/40 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <SelectItem key={n} value={n.toString()}>{n} AI</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {registrySupported && registeredAgents.length > 0 && (
                <p className="mt-2 text-xs text-purple-300/80 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {registeredAgents.length} verified on-chain
                </p>
              )}
            </div>

            <div className="bg-gradient-to-br from-red-900/40 to-orange-900/40 rounded-2xl p-6 border border-red-500/30">
              <div className="flex items-center gap-3 mb-4">
                <FaBrain className="w-7 h-7 text-red-400" />
                <h3 className="text-xl font-bold text-red-300">AI Difficulty</h3>
              </div>
              <Select
                value={settings.aiDifficulty}
                onValueChange={(v) => setSettings((p) => ({ ...p, aiDifficulty: v as any }))}
              >
                <SelectTrigger className="h-14 bg-black/60 border-red-500/40 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                  <SelectItem value="boss" className="text-pink-400 font-bold">BOSS MODE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Column 2 */}
          <div className="bg-gradient-to-br from-amber-900/40 to-orange-900/40 rounded-2xl p-6 border border-amber-500/30">
            <div className="flex items-center gap-3 mb-4">
              <FaCoins className="w-7 h-7 text-amber-400" />
              <h3 className="text-xl font-bold text-amber-300">Starting Cash</h3>
            </div>
            <Select
              value={settings.startingCash.toString()}
              onValueChange={(v) => setSettings((p) => ({ ...p, startingCash: +v }))}
            >
              <SelectTrigger className="h-14 bg-black/60 border-amber-500/40 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="500">$500</SelectItem>
                <SelectItem value="1000">$1,000</SelectItem>
                <SelectItem value="1500">$1,500</SelectItem>
                <SelectItem value="2000">$2,000</SelectItem>
                <SelectItem value="5000">$5,000</SelectItem>
              </SelectContent>
            </Select>
            <div className="mt-8">
              <div className="flex items-center gap-3 mb-4">
                <FaBrain className="w-7 h-7 text-indigo-400" />
                <h3 className="text-xl font-bold text-indigo-300">Game Duration</h3>
              </div>
              <Select
                value={settings.duration.toString()}
                onValueChange={(v) => setSettings((p) => ({ ...p, duration: +v }))}
              >
                <SelectTrigger className="h-14 bg-black/60 border-indigo-500/40 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 minutes</SelectItem>
                  <SelectItem value="5">5 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">60 minutes</SelectItem>
                  <SelectItem value="90">90 minutes</SelectItem>
                  <SelectItem value="0">No limit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Column 3 */}
          <div className="space-y-6">
            {registrySupported && registeredAgents.length > 0 && !agentsLoading && (
              <div className="bg-gradient-to-br from-emerald-900/40 to-teal-900/40 rounded-2xl p-6 border border-emerald-500/30">
                <div className="flex items-center gap-3 mb-3">
                  <ShieldCheck className="w-6 h-6 text-emerald-400" />
                  <h3 className="text-lg font-bold text-emerald-300">Registered AI Agents</h3>
                </div>
                <ul className="space-y-2 max-h-32 overflow-y-auto">
                  {registeredAgents.map((a) => (
                    <li key={a.tokenId} className="text-sm text-gray-300 flex justify-between items-center gap-2">
                      <span className="font-medium text-white truncate">{a.name}</span>
                      <span className="text-emerald-400/90 shrink-0">{a.playStyle}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="bg-black/60 rounded-2xl p-6 border border-cyan-500/30 h-full">
              <h3 className="text-xl font-bold text-cyan-400 mb-5 text-center">House Rules</h3>
              <div className="space-y-4">
                {[
                  { icon: RiAuctionFill, label: "Auction Unsold Properties", key: "auction" },
                  { icon: GiPrisoner, label: "Pay Rent in Jail", key: "rentInPrison" },
                  { icon: GiBank, label: "Allow Mortgages", key: "mortgage" },
                  { icon: IoBuild, label: "Even Building Rule", key: "evenBuild" },
                  { icon: FaRandom, label: "Random Play Order", key: "randomPlayOrder" },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5 text-cyan-400" />
                      <span className="text-gray-300 text-sm">{item.label}</span>
                    </div>
                    <Switch
                      checked={settings[item.key as keyof typeof settings] as boolean}
                      onCheckedChange={(v) => setSettings((p) => ({ ...p, [item.key]: v }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center mt-12">
          <button
            onClick={handlePlay}
            disabled={!canCreate || (!isGuest && isCreatePending)}
            className="relative px-24 py-6 text-3xl font-orbitron font-black tracking-widest
                     bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-600
                     hover:from-pink-600 hover:via-purple-600 hover:to-cyan-500
                     rounded-2xl shadow-2xl transform hover:scale-105 active:scale-100
                     transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed
                     border-4 border-white/20"
          >
            <span className="relative z-10 text-white drop-shadow-2xl">
              {isCreatePending ? "SUMMONING..." : "START BATTLE"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
