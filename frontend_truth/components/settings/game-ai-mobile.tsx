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

export default function PlayWithAIMobile() {
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
      <div className="w-full h-screen flex items-center justify-center bg-settings bg-cover bg-center">
        <p className="text-[#00F0FF] text-3xl font-orbitron animate-pulse text-center px-6">
          LOADING ARENA...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-settings bg-cover bg-fixed flex flex-col pt-[70px]">
      <div className="px-5 pt-6 pb-4">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition group"
          >
            <House className="w-5 h-5 group-hover:-translate-x-1 transition" />
            <span className="font-bold text-sm">BACK</span>
          </button>
          <h1 className="text-2xl font-orbitron font-extrabold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
            AI DUEL
          </h1>
          <div className="w-14" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-10">
        <div className="max-w-md mx-auto space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-cyan-900/40 to-blue-900/40 rounded-xl p-4 border border-cyan-500/30">
              <div className="flex items-center gap-2 mb-2">
                <FaUser className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-cyan-300">Your Piece</h3>
              </div>
              <Select value={settings.symbol} onValueChange={(v) => setSettings((p) => ({ ...p, symbol: v }))}>
                <SelectTrigger className="h-10 bg-black/60 border-cyan-500/40 text-white text-sm">
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  {GamePieces.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 rounded-xl p-4 border border-purple-500/30">
              <div className="flex items-center gap-2 mb-2">
                <FaRobot className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-purple-300">AI Opponents</h3>
              </div>
              <Select
                value={settings.aiCount.toString()}
                onValueChange={(v) => setSettings((p) => ({ ...p, aiCount: +v }))}
              >
                <SelectTrigger className="h-10 bg-black/60 border-purple-500/40 text-white text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <SelectItem key={n} value={n.toString()}>{n} AI</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {registrySupported && registeredAgents.length > 0 && (
                <p className="mt-1.5 text-[10px] text-purple-300/80 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  {registeredAgents.length} verified
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-amber-900/40 to-orange-900/40 rounded-xl p-4 border border-amber-500/30">
              <div className="flex items-center gap-2 mb-2">
                <FaCoins className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-amber-300">Starting Cash</h3>
              </div>
              <Select
                value={settings.startingCash.toString()}
                onValueChange={(v) => setSettings((p) => ({ ...p, startingCash: +v }))}
              >
                <SelectTrigger className="h-10 bg-black/60 border-amber-500/40 text-white text-sm">
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
            </div>

            <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 rounded-xl p-4 border border-indigo-500/30">
              <div className="flex items-center gap-2 mb-2">
                <FaBrain className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-indigo-300">Duration</h3>
              </div>
              <Select
                value={settings.duration.toString()}
                onValueChange={(v) => setSettings((p) => ({ ...p, duration: +v }))}
              >
                <SelectTrigger className="h-10 bg-black/60 border-indigo-500/40 text-white text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2m</SelectItem>
                  <SelectItem value="5">5m</SelectItem>
                  <SelectItem value="30">30m</SelectItem>
                  <SelectItem value="45">45m</SelectItem>
                  <SelectItem value="60">60m</SelectItem>
                  <SelectItem value="90">90m</SelectItem>
                  <SelectItem value="0">No limit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-900/40 to-orange-900/40 rounded-xl p-4 border border-red-500/30">
            <div className="flex items-center gap-2 mb-2">
              <FaBrain className="w-4 h-4 text-red-400" />
              <h3 className="text-sm font-bold text-red-300">AI Difficulty</h3>
            </div>
            <Select
              value={settings.aiDifficulty}
              onValueChange={(v) => setSettings((p) => ({ ...p, aiDifficulty: v as any }))}
            >
              <SelectTrigger className="h-10 bg-black/60 border-red-500/40 text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
                <SelectItem value="boss" className="text-pink-400 font-bold">BOSS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {registrySupported && registeredAgents.length > 0 && !agentsLoading && (
            <div className="bg-gradient-to-br from-emerald-900/40 to-teal-900/40 rounded-xl p-4 border border-emerald-500/30">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-emerald-300">Verified AI</h3>
              </div>
              <ul className="space-y-1 max-h-20 overflow-y-auto">
                {registeredAgents.map((a) => (
                  <li key={a.tokenId} className="text-xs text-gray-300 flex justify-between items-center gap-2">
                    <span className="font-medium text-white truncate">{a.name}</span>
                    <span className="text-emerald-400/90 shrink-0 text-[10px]">{a.playStyle}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-black/60 rounded-xl p-4 border border-cyan-500/30">
            <h3 className="text-base font-bold text-cyan-400 mb-3 text-center">House Rules</h3>
            <div className="space-y-2">
              {[
                { icon: RiAuctionFill, label: "Auction Unsold", key: "auction" },
                { icon: GiPrisoner, label: "Rent in Jail", key: "rentInPrison" },
                { icon: GiBank, label: "Mortgages", key: "mortgage" },
                { icon: IoBuild, label: "Even Build", key: "evenBuild" },
                { icon: FaRandom, label: "Random Order", key: "randomPlayOrder" },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <item.icon className="w-4 h-4 text-cyan-400" />
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

          <div className="pt-4 pb-4">
            <button
              onClick={handlePlay}
              disabled={!canCreate || (!isGuest && isCreatePending)}
              className="w-full py-4 text-lg font-orbitron font-bold tracking-wide
                       bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-600
                       hover:brightness-110 active:scale-[0.98]
                       rounded-xl shadow-lg transition-all duration-300
                       disabled:opacity-50 disabled:cursor-not-allowed
                       border-2 border-white/20 text-white"
            >
              {!isGuest && isCreatePending ? "SUMMONING..." : "START BATTLE"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
