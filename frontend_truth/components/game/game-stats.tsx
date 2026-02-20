"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useGetUsername, useIsRegistered } from "@/context/ContractProvider";
import { toast } from "react-toastify";
import { BarChart2, Trophy, Wallet, Crown, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import herobg from "@/public/heroBg.png";

interface PlayerStats {
  totalGames: number;
  wins: number;
  tokensEarned: number;
  ranking: number;
  winRate: string;
}

interface LeaderboardEntry {
  username: string;
  totalGames: number;
  wins: number;
  ranking: number;
  avatar?: string;
}

const GameStats: React.FC = () => {
  const router = useRouter();
  const { address, isConnecting } = useAccount();
  const { data: isUserRegistered, error: registeredError } = useIsRegistered(address);
  const { data: username } = useGetUsername(address);
  const [playerStats] = useState<PlayerStats>({
    totalGames: 42,
    wins: 15,
    tokensEarned: 2500,
    ranking: 3,
    winRate: "35.7%",
  });
  const [leaderboard] = useState<LeaderboardEntry[]>([
    { username: "CryptoKing", totalGames: 100, wins: 50, ranking: 1, avatar: "/game/cairo.svg" },
    { username: "BlockBaron", totalGames: 80, wins: 40, ranking: 2, avatar: "/game/dubai.svg" },
    { username: "PixelTycoon", totalGames: 60, wins: 30, ranking: 3, avatar: "/game/canberra.svg" },
    { username: username || "You", totalGames: 42, wins: 15, ranking: 4, avatar: "/game/berlin.svg" },
  ]);
  const [gameIdQuery, setGameIdQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (registeredError) {
      console.error("Registered error:", registeredError);
      toast.error(
        registeredError?.message || "Failed to check registration status",
        {
          position: "top-right",
          autoClose: 5000,
        }
      );
    }
  }, [registeredError]);

  const handleGameIdQuery = () => {
    // Placeholder for querying specific game stats (no validation to avoid errors)
    toast.info("Specific game stats feature coming soon!", {
      position: "top-right",
      autoClose: 3000,
    });
  };

  if (isConnecting) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <p className="font-orbitron text-[#00F0FF] text-[16px]">
          Connecting to wallet...
        </p>
      </div>
    );
  }

  if (!address || !isUserRegistered) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-b from-[#010F10] to-[#0E1415] flex flex-col items-center justify-center">
        <p className="font-orbitron text-[#00F0FF] text-[16px] mb-4 text-center">
          {address
            ? "Please register to view your game stats."
            : "Please connect your wallet to view game stats."}
        </p>
        <Link
          href="/"
          className="relative group w-[200px] h-[40px] bg-transparent border-none p-0 overflow-hidden cursor-pointer"
        >
          <svg
            width="200"
            height="40"
            viewBox="0 0 200 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute top-0 left-0 w-full h-full"
          >
            <path
              d="M6 1H194C198.373 1 200.996 5.85486 198.601 9.5127L180.167 37.5127C179.151 39.0646 177.42 40 175.565 40H6C2.96244 40 0.5 37.5376 0.5 34.5V6.5C0.5 3.46243 2.96243 1 6 1Z"
              fill="#0E1415"
              stroke="#003B3E"
              strokeWidth={1}
              className="group-hover:stroke-[#00F0FF] transition-all duration-300 ease-in-out"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[#00F0FF] capitalize text-[12px] font-dmSans font-medium z-10">
            Back to Home
          </span>
        </Link>
      </div>
    );
  }

  return (
    <section className="z-0 w-full min-h-screen relative overflow-x-hidden bg-gradient-to-b from-[#010F10] to-[#0E1415]">
      {/* Background Image */}
      <div className="w-full h-full absolute inset-0 overflow-hidden">
        <Image
          src={herobg}
          alt="Hero Background"
          className="w-full h-full object-cover hero-bg-zoom opacity-50"
          width={1440}
          height={1024}
          priority
          quality={100}
        />
      </div>

      {/* Overlay for readability */}
      <div className="w-full h-full absolute inset-0 bg-gradient-to-b from-transparent via-[#010F10]/80 to-[#010F10]"></div>

      {/* Header */}
      <header className="w-full h-[87px] flex items-center justify-between px-4 md:px-8 bg-[linear-gradient(180deg,rgba(1,15,16,0.12)_0%,rgba(8,50,52,0.12)_100%)] backdrop-blur-sm relative z-[50] border-b border-[#003B3E]">
        <Link
          href="/"
          className="text-[#00F0FF] text-xl font-bold flex items-center gap-2 hover:text-[#0FF0FC] transition-colors"
        >
          ← Back to Tycoon
        </Link>
        <h1 className="text-2xl uppercase font-kronaOne text-transparent bg-clip-text bg-gradient-to-r from-[#00F0FF] to-[#0FF0FC]">
          Game Stats
        </h1>
        <div className="w-10" /> {/* Spacer */}
      </header>

      {/* Content */}
      <main className="w-full relative z-20 flex flex-col items-center gap-8 py-8 px-4 md:px-8">
        <div className="text-center">
          <h2 className="font-orbitron text-[32px] md:text-[48px] lg:text-[64px] font-[900] text-[#00F0FF] uppercase tracking-[-0.02em] mb-2">
            Your Empire Stats
          </h2>
          <p className="font-orbitron text-[18px] md:text-[24px] text-[#F0F7F7] font-[700]">
            Welcome back, <span className="text-[#00F0FF]">{username || "Tycoon"}</span>!
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="font-orbitron text-[#00F0FF] text-[18px]">
              Loading empire data...
            </p>
          </div>
        ) : (
          <div className="w-full max-w-6xl flex flex-col gap-8">
            {/* Player Stats Grid */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-[#0E1415]/80 backdrop-blur-sm rounded-[16px] border border-[#003B3E] p-6 hover:border-[#00F0FF]/50 transition-all duration-300 group">
                <div className="flex items-center justify-center w-12 h-12 bg-[#00F0FF]/10 rounded-full mb-4 group-hover:bg-[#00F0FF]/20 transition-colors">
                  <BarChart2 className="w-6 h-6 text-[#00F0FF]" />
                </div>
                <h3 className="font-orbitron text-lg text-[#00F0FF] font-bold mb-2 text-center">Total Games</h3>
                <p className="text-3xl font-bold text-[#F0F7F7] text-center">{playerStats.totalGames}</p>
              </div>
              <div className="bg-[#0E1415]/80 backdrop-blur-sm rounded-[16px] border border-[#003B3E] p-6 hover:border-[#00F0FF]/50 transition-all duration-300 group">
                <div className="flex items-center justify-center w-12 h-12 bg-[#FFD700]/10 rounded-full mb-4 group-hover:bg-[#FFD700]/20 transition-colors">
                  <Trophy className="w-6 h-6 text-[#FFD700]" />
                </div>
                <h3 className="font-orbitron text-lg text-[#FFD700] font-bold mb-2 text-center">Wins</h3>
                <p className="text-3xl font-bold text-[#F0F7F7] text-center">{playerStats.wins}</p>
                <p className="text-sm text-[#AFBAC0] text-center mt-1">{playerStats.winRate} Win Rate</p>
              </div>
              <div className="bg-[#0E1415]/80 backdrop-blur-sm rounded-[16px] border border-[#003B3E] p-6 hover:border-[#00F0FF]/50 transition-all duration-300 group">
                <div className="flex items-center justify-center w-12 h-12 bg-[#00F0FF]/10 rounded-full mb-4 group-hover:bg-[#00F0FF]/20 transition-colors">
                  <Wallet className="w-6 h-6 text-[#00F0FF]" />
                </div>
                <h3 className="font-orbitron text-lg text-[#00F0FF] font-bold mb-2 text-center">BLOCK Tokens</h3>
                <p className="text-3xl font-bold text-[#F0F7F7] text-center">{playerStats.tokensEarned.toLocaleString()}</p>
              </div>
              <div className="bg-[#0E1415]/80 backdrop-blur-sm rounded-[16px] border border-[#003B3E] p-6 hover:border-[#00F0FF]/50 transition-all duration-300 group">
                <div className="flex items-center justify-center w-12 h-12 bg-[#FFD700]/10 rounded-full mb-4 group-hover:bg-[#FFD700]/20 transition-colors">
                  <Crown className="w-6 h-6 text-[#FFD700]" />
                </div>
                <h3 className="font-orbitron text-lg text-[#FFD700] font-bold mb-2 text-center">Tycoon Rank</h3>
                <p className="text-3xl font-bold text-[#F0F7F7] text-center">#{playerStats.ranking}</p>
              </div>
            </section>

            {/* Leaderboard */}
            <section className="bg-[#0E1415]/80 backdrop-blur-sm rounded-[16px] border border-[#003B3E] p-6">
              <h3 className="font-orbitron text-2xl text-[#00F0FF] font-bold mb-6 flex items-center gap-2 justify-center">
                <Users className="w-6 h-6" />
                Global Leaderboard
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-[#F0F7F7] font-dmSans">
                  <thead>
                    <tr className="border-b border-[#003B3E]/50">
                      <th className="py-4 px-4 text-left font-semibold">Rank</th>
                      <th className="py-4 px-4 text-left font-semibold">Tycoon</th>
                      <th className="py-4 px-4 text-left font-semibold hidden md:table-cell">Games</th>
                      <th className="py-4 px-4 text-left font-semibold">Wins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((entry, index) => (
                      <tr
                        key={index}
                        className={`border-b border-[#003B3E]/50 hover:bg-[#00F0FF]/5 transition-colors ${
                          entry.username === (username || "You") ? "bg-[#00F0FF]/10" : ""
                        }`}
                      >
                        <td className="py-4 px-4 font-bold text-[#FFD700]">{entry.ranking === 1 ? "🏆" : `#${entry.ranking}`}</td>
                        <td className="py-4 px-4 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#00F0FF]/20 overflow-hidden">
                            <Image
                              src={entry.avatar || "/public/avatar.jpg"}
                              alt={entry.username}
                              width={32}
                              height={32}
                              className="object-cover"
                            />
                          </div>
                          <span className={entry.username === (username || "You") ? "text-[#00F0FF] font-bold" : ""}>
                            {entry.username}
                          </span>
                        </td>
                        <td className="py-4 px-4 hidden md:table-cell">{entry.totalGames}</td>
                        <td className="py-4 px-4 font-bold">{entry.wins}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Specific Game Stats Query */}
            <section className="bg-[#0E1415]/80 backdrop-blur-sm rounded-[16px] border border-[#003B3E] p-6">
              <h3 className="font-orbitron text-xl text-[#00F0FF] font-bold mb-4 flex items-center gap-2">
                <BarChart2 className="w-5 h-5" />
                Query Specific Conquest
              </h3>
              <div className="flex flex-col sm:flex-row gap-4">
                <input
                  type="text"
                  value={gameIdQuery}
                  onChange={(e) => setGameIdQuery(e.target.value)}
                  placeholder="Enter Conquest ID (e.g., #12345)"
                  className="flex-1 h-[48px] bg-[#0E1415]/50 rounded-[12px] border border-[#003B3E] outline-none px-4 text-[#17ffff] font-orbitron font-[400] text-[16px] placeholder:text-[#455A64] placeholder:font-dmSans focus:border-[#00F0FF] transition-colors"
                />
                <button
                  type="button"
                  onClick={handleGameIdQuery}
                  className="relative group w-full sm:w-auto h-[48px] bg-transparent border-none p-0 overflow-hidden cursor-pointer"
                >
                  <svg
                    width="140"
                    height="48"
                    viewBox="0 0 140 48"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="absolute top-0 left-0 w-full h-full"
                  >
                    <path
                      d="M6 1H134C138.373 1 140.996 5.85486 138.601 9.5127L120.167 45.5127C119.151 47.0646 117.42 48 115.565 48H6C2.96244 48 0.5 45.5376 0.5 42.5V5.5C0.5 2.46243 2.96243 1 6 1Z"
                      fill="#0E1415"
                      stroke="#003B3E"
                      strokeWidth={1}
                      className="group-hover:stroke-[#00F0FF] transition-all duration-300 ease-in-out"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[#00F0FF] capitalize text-[14px] font-dmSans font-medium z-10">
                    Decode Battle
                  </span>
                </button>
              </div>
              <p className="font-dmSans text-[14px] text-[#AFBAC0] mt-3 text-center sm:text-left">
                Unlock detailed conquest logs – feature deploying soon.
              </p>
            </section>
          </div>
        )}

        {/* Back to Home Button */}
        <Link
          href="/"
          className="relative group w-[220px] h-[48px] bg-transparent border-none p-0 overflow-hidden cursor-pointer mb-8"
        >
          <svg
            width="220"
            height="48"
            viewBox="0 0 220 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute top-0 left-0 w-full h-full"
          >
            <path
              d="M10 1H210C214.373 1 216.996 5.85486 214.601 9.5127L196.167 45.5127C195.151 47.0646 193.42 48 191.565 48H10C6.96244 48 4.5 45.5376 4.5 42.5V5.5C4.5 2.46243 6.96243 1 10 1Z"
              fill="#0E1415"
              stroke="#003B3E"
              strokeWidth={1}
              className="group-hover:stroke-[#00F0FF] transition-all duration-300 ease-in-out"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[#00F0FF] capitalize text-[14px] font-dmSans font-medium z-10">
            Return to the Block
          </span>
        </Link>
      </main>
    </section>
  );
};

export default GameStats;