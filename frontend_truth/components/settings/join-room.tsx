"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { IoHomeOutline, IoArrowForwardOutline } from "react-icons/io5";
import { useAccount } from "wagmi";
import { apiClient } from "@/lib/api";
import { ApiResponse } from "@/types/api";
import { Game } from "@/lib/types/games";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";

export default function JoinRoom(): JSX.Element {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;
  const canAct = isConnected || !!guestUser;

  const [code, setCode] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [recentGames, setRecentGames] = useState<Game[]>([]);
  const [allPendingGames, setAllPendingGames] = useState<Game[]>([]);
  const [pendingGames, setPendingGames] = useState<Game[]>([]);
  const [fetchingRecent, setFetchingRecent] = useState<boolean>(true);
  const [fetchingPending, setFetchingPending] = useState<boolean>(true);
  const [timeFilter, setTimeFilter] = useState<number>(5 * 60 * 1000); // Default: last 5 minutes in ms

  // Time filter options - prioritize recent games
  const timeOptions = [
    { label: "Last 5 minutes", value: 5 * 60 * 1000 },
    { label: "Last 10 minutes", value: 10 * 60 * 1000 },
    { label: "Last 30 minutes", value: 30 * 60 * 1000 },
    { label: "Last hour", value: 60 * 60 * 1000 },
    { label: "All pending", value: Infinity },
  ];

  // Uppercase and trim code input
  const normalizedCode = useMemo(() => code.trim().toUpperCase(), [code]);

  useEffect(() => {
    if (!canAct) {
      setFetchingRecent(false);
      setFetchingPending(false);
      return;
    }
    const addr = address ?? guestUser?.address;
    if (!addr) {
      setFetchingRecent(false);
      setFetchingPending(false);
      return;
    }

    const fetchRecent = async () => {
      try {
        const res = await apiClient.get<ApiResponse>("/games/my-games", {
          params: { address: addr },
        });
        if (res?.data?.success && Array.isArray(res.data.data)) {
          setRecentGames(res.data.data as Game[]);
        }
      } catch (err) {
        console.error("Failed to fetch recent games:", err);
      } finally {
        setFetchingRecent(false);
      }
    };

    const fetchPending = async () => {
      try {
        const res = await apiClient.get<ApiResponse>("/games/pending");
        if (res?.data?.success && Array.isArray(res.data.data)) {
          setAllPendingGames(res.data.data as Game[]);
        }
      } catch (err) {
        console.error("Failed to fetch pending games:", err);
      } finally {
        setFetchingPending(false);
      }
    };

    fetchRecent();
    fetchPending();
  }, [address, canAct, guestUser?.address]);

  // Only show games that are not finished (so "Continue Game" is never for ended games)
  const activeRecentGames = useMemo(
    () =>
      recentGames.filter(
        (g) => g.status !== "COMPLETED" && g.status !== "CANCELLED"
      ),
    [recentGames]
  );

  // Filter and sort pending games based on timeFilter
  useEffect(() => {
    const now = Date.now();
    let filtered = allPendingGames;

    if (timeFilter !== Infinity) {
      filtered = filtered.filter(
        (game) =>
          game.created_at && // Assume created_at is an ISO string or timestamp
          now - new Date(game.created_at).getTime() <= timeFilter
      );
    }

    // Sort by created_at descending (most recent first)
    const sorted = filtered.sort(
      (a, b) =>
        new Date(b.created_at ?? 0).getTime() -
        new Date(a.created_at ?? 0).getTime()
    );

    setPendingGames(sorted);
  }, [allPendingGames, timeFilter]);

  const handleJoinByCode = useCallback(async () => {
    if (!normalizedCode) {
      setError("Please enter a game code.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await apiClient.get<ApiResponse>(
        `/games/code/${encodeURIComponent(normalizedCode)}`
      );

      if (!res?.data?.success || !res.data.data) {
        throw new Error("Game not found. Check the code and try again.");
      }

      const game: Game = res.data.data;

      if (game.status === "RUNNING") {
        // Game already started — go directly to play if player is in it
        const addr = address ?? guestUser?.address;
        const isPlayerInGame = addr && game.players.some(
          (p) => String(p.address || "").toLowerCase() === addr.toLowerCase()
        );

        if (isPlayerInGame) {
          router.push(`/game-play?gameCode=${encodeURIComponent(normalizedCode)}`);
        } else {
          throw new Error("This game has already started and you are not a player.");
        }
      } else if (game.status === "PENDING") {
        // Game waiting — go to waiting room (sign in as guest or connect wallet there to join)
        router.push(`/game-waiting?gameCode=${encodeURIComponent(normalizedCode)}`);
      } else {
        throw new Error("This game is no longer active.");
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to join game. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [normalizedCode, address, guestUser?.address, router]);

  const handleContinueGame = useCallback(
    (game: Game) => {
      if (game.status === "RUNNING") {
        router.push(`/game-play?gameCode=${encodeURIComponent(game.code)}`);
      } else if (game.status === "PENDING") {
        router.push(`/game-waiting?gameCode=${encodeURIComponent(game.code)}`);
      }
    },
    [router]
  );

  const handleJoinPublicGame = useCallback(
    (game: Game) => {
      if (game.status === "PENDING") {
        router.push(`/game-waiting?gameCode=${encodeURIComponent(game.code)}`);
      }
    },
    [router]
  );

  const handleCreateNew = () => router.push("/game-settings");

  return (
    <section className="w-full min-h-screen bg-settings bg-cover bg-fixed bg-center bg-[#010F10]">
      <main className="w-full min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#010F10]/90 to-[#010F10]/50 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-xl lg:max-w-4xl bg-[#0A1A1B]/80 p-6 sm:p-8 lg:p-12 rounded-2xl shadow-2xl border border-[#00F0FF]/50 backdrop-blur-md">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-orbitron mb-8 lg:mb-12 text-center tracking-widest bg-gradient-to-r from-[#00F0FF] to-[#FF00FF] bg-clip-text text-transparent animate-pulse">
            Join Tycoon
          </h2>

          {/* Top Section: Enter Code and Create New Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {/* Enter Game Code */}
            <div className="space-y-6">
              <h3 className="text-xl lg:text-2xl font-bold text-[#00F0FF] text-center font-orbitron">
                Enter Game Code
              </h3>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoinByCode()}
                  placeholder="ABCD1234"
                  className="flex-1 bg-[#0A1A1B] text-[#F0F7F7] px-5 py-4 rounded-xl border border-[#00F0FF]/50 focus:outline-none focus:ring-2 focus:ring-[#00F0FF] font-orbitron text-lg uppercase tracking-wider shadow-inner"
                  maxLength={12}
                />
                <button
                  onClick={handleJoinByCode}
                  disabled={loading || !normalizedCode}
                  className="bg-gradient-to-r from-[#00F0FF] to-[#FF00FF] text-black font-orbitron font-extrabold px-8 py-4 rounded-xl hover:opacity-90 transition-all shadow-lg hover:shadow-[#00F0FF]/50 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? "Checking..." : "Join"}
                  <IoArrowForwardOutline className="w-6 h-6" />
                </button>
              </div>

              {error && (
                <p className="text-red-400 text-sm text-center bg-red-900/50 p-3 rounded-lg animate-pulse font-orbitron">
                  {error}
                </p>
              )}
            </div>

            {/* Create New Game */}
            <div className="space-y-6 text-center">
              <h3 className="text-xl lg:text-2xl font-bold text-[#00F0FF] text-center font-orbitron">
                Create New Game
              </h3>
              <p className="text-[#869298] text-sm mb-4">Want to host?</p>
              <button
                onClick={handleCreateNew}
                className="bg-gradient-to-r from-[#00FFAA] to-[#00F0FF] text-black font-orbitron font-extrabold px-8 py-4 rounded-xl hover:opacity-90 transition-all shadow-lg hover:shadow-[#00FFAA]/50 transform hover:scale-105 w-full md:w-auto"
              >
                Create New Game
              </button>
            </div>
          </div>

          {/* Games Section */}
          <div className="space-y-12">
            {canAct && (
              <>
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl lg:text-2xl font-bold text-[#00F0FF] font-orbitron">
                      Recent Public Games
                    </h3>
                    <select
                      value={timeFilter}
                      onChange={(e) => setTimeFilter(Number(e.target.value))}
                      className="bg-[#0A1A1B] text-[#F0F7F7] px-3 py-2 rounded-lg border border-[#00F0FF]/50 focus:outline-none focus:ring-2 focus:ring-[#00F0FF] font-orbitron text-sm"
                    >
                      {timeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {fetchingPending ? (
                    <p className="text-[#869298] text-center">Loading public games...</p>
                  ) : pendingGames.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {pendingGames.map((game) => (
                        <div
                          key={game.id}
                          className="bg-[#010F10]/70 p-5 rounded-xl border border-[#00F0FF]/40 hover:border-[#00F0FF] transition-all shadow-md hover:shadow-[#00F0FF]/50 flex flex-col items-center justify-between group"
                        >
                          <div className="text-center mb-4">
                            <p className="text-[#F0F7F7] font-orbitron font-bold text-lg">
                              Code: {game.code}
                            </p>
                            <p className="text-[#869298] text-sm">
                              Players: {game.players.length}/{game.number_of_players} • Pending
                            </p>
                          </div>
                          <button
                            onClick={() => handleJoinPublicGame(game)}
                            className="bg-gradient-to-r from-[#00F0FF] to-[#FF00FF] text-black font-orbitron font-bold px-4 py-2 rounded-lg hover:opacity-90 transition-all shadow-lg hover:shadow-[#00F0FF]/50 transform hover:scale-105"
                          >
                            Join
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[#869298] text-center">No recent public games available.</p>
                  )}
                </div>

                {activeRecentGames.length > 0 && (
                  <div className="space-y-6">
                    <h3 className="text-xl lg:text-2xl font-bold text-[#00F0FF] text-center font-orbitron">
                      Continue Game
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {activeRecentGames.map((game) => (
                        <button
                          key={game.id}
                          onClick={() => handleContinueGame(game)}
                          className="bg-[#010F10]/70 p-5 rounded-xl border border-[#00F0FF]/40 hover:border-[#00F0FF] transition-all shadow-md hover:shadow-[#00F0FF]/50 flex flex-col items-center justify-between group"
                        >
                          <div className="text-center mb-4">
                            <p className="text-[#F0F7F7] font-orbitron font-bold text-lg">
                              Code: {game.code}
                            </p>
                            <p className="text-[#869298] text-sm">
                              Players: {game.players.length}/{game.number_of_players} •{" "}
                              {game.status === "PENDING" ? "Waiting" : "In Progress"}
                            </p>
                          </div>
                          <IoArrowForwardOutline className="w-8 h-8 text-[#00F0FF] group-hover:translate-x-2 transition-transform" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {!canAct && (
              <div className="mt-6 space-y-3 text-center">
                <p className="text-yellow-400 text-sm bg-yellow-900/30 p-3 rounded-lg font-orbitron">
                  Connect your wallet or sign in as guest to join or continue games.
                </p>
                <a
                  href="/"
                  className="inline-block px-6 py-3 bg-[#00F0FF]/20 text-[#00F0FF] font-orbitron font-bold rounded-lg border border-[#00F0FF]/50 hover:bg-[#00F0FF]/30 transition-all"
                >
                  Sign in as guest (home)
                </a>
              </div>
            )}
          </div>

          {/* Footer Links */}
          <div className="flex justify-center mt-10 lg:mt-12">
            <button
              onClick={() => router.push("/")}
              className="flex items-center text-[#0FF0FC] text-base font-orbitron hover:text-[#00D4E6] transition-colors hover:underline gap-2"
            >
              <IoHomeOutline className="w-5 h-5" />
              Back to HQ
            </button>
          </div>
        </div>
      </main>
    </section>
  );
}