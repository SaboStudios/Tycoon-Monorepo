"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PiTelegramLogoLight } from "react-icons/pi";
import { FaXTwitter, FaCoins } from "react-icons/fa6";
import { SiFarcaster } from "react-icons/si";
import { IoCopyOutline, IoHomeOutline } from "react-icons/io5";
import { toast } from "react-toastify";

// --- TYPES & CONSTANTS ---
export interface PlayerSymbol {
  name: string;
  value: string;
  emoji: string;
}

const SYMBOLS: PlayerSymbol[] = [
  { name: "Ship", value: "ship", emoji: "🚢" },
  { name: "Car", value: "car", emoji: "🚗" },
  { name: "Plane", value: "plane", emoji: "✈️" },
  { name: "Truck", value: "truck", emoji: "🚚" },
];

const COPY_FEEDBACK_MS = 2000;

// --- DUMMY DATA FOR UI TESTING ---
const DUMMY_PLAYERS = [
  { address: "0x123...abc", username: "Player1", symbol: "ship" },
  { address: "0x456...def", username: "Player2", symbol: "car" },
];

const DUMMY_GAME_CONFIG = {
  code: "TYCOON",
  maxPlayers: 4,
  stakeLabel: "10 USDC",
  stakeValue: BigInt("10000000"), 
};
// --------------------------------

export default function GameWaiting(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawGameCode = searchParams.get("gameCode") ?? DUMMY_GAME_CONFIG.code;
  const gameCode = rawGameCode.trim().toUpperCase();

  // Local UI state
  const [gamePlayers, setGamePlayers] = useState<any[]>(DUMMY_PLAYERS);
  const [playerSymbol, setPlayerSymbol] = useState<PlayerSymbol | null>(null);
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [copySuccessFarcaster, setCopySuccessFarcaster] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [contractGameLoading, setContractGameLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    const timer = setTimeout(() => {
      setLoading(false);
      setContractGameLoading(false);
    }, 1500);

    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
    };
  }, []);

  // Compute available symbols based on taken symbols
  const availableSymbols = useMemo(() => {
    const taken = new Set(gamePlayers.map((p: any) => p.symbol));
    return SYMBOLS.filter((s: PlayerSymbol) => !taken.has(s.value));
  }, [gamePlayers]);

  const origin = useMemo(() => {
    try {
      if (typeof window === "undefined") return "";
      return window.location?.origin ?? "";
    } catch {
      return "";
    }
  }, []);

  const gameUrl = useMemo(
    () => `${origin}/game-waiting?gameCode=${encodeURIComponent(gameCode)}`,
    [origin, gameCode]
  );

  const farcasterMiniappUrl = useMemo(
    () =>
      `https://farcaster.xyz/miniapps/bylqDd2BdAR5/tycoon/game-waiting?gameCode=${encodeURIComponent(gameCode)}`,
    [gameCode]
  );

  const shareText = useMemo(
    () => `Join my Tycoon game! Code: ${gameCode}. Waiting room: ${gameUrl}`,
    [gameCode, gameUrl]
  );

  const farcasterShareText = useMemo(
    () => `Join my Tycoon game! Code: ${gameCode}.`,
    [gameCode]
  );

  const telegramShareUrl = useMemo(
    () =>
      `https://t.me/share/url?url=${encodeURIComponent(
        gameUrl
      )}&text=${encodeURIComponent(shareText)}`,
    [gameUrl, shareText]
  );

  const twitterShareUrl = useMemo(
    () => `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
    [shareText]
  );

  const farcasterShareUrl = useMemo(
    () =>
      `https://warpcast.com/~/compose?text=${encodeURIComponent(farcasterShareText)}&embeds[]=${encodeURIComponent(farcasterMiniappUrl)}`,
    [farcasterShareText, farcasterMiniappUrl]
  );

  const handleCopyLink = useCallback(async () => {
    if (!gameUrl) {
      setError("No shareable URL available.");
      return;
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(gameUrl);
      } else {
        const el = document.createElement("textarea");
        el.value = gameUrl;
        el.setAttribute("readonly", "");
        el.style.position = "absolute";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopySuccess("Copied!");
      setTimeout(() => setCopySuccess(null), COPY_FEEDBACK_MS);
    } catch (err) {
      console.error("copy failed", err);
      setError("Failed to copy link. Try manually selecting the text.");
    }
  }, [gameUrl]);

  const handleCopyFarcasterLink = useCallback(async () => {
    if (!farcasterMiniappUrl) {
      setError("No shareable Farcaster URL available.");
      return;
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(farcasterMiniappUrl);
      } else {
        const el = document.createElement("textarea");
        el.value = farcasterMiniappUrl;
        el.setAttribute("readonly", "");
        el.style.position = "absolute";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopySuccessFarcaster("Farcaster link copied!");
      setTimeout(() => setCopySuccessFarcaster(null), COPY_FEEDBACK_MS);
    } catch (err) {
      console.error("copy farcaster failed", err);
      setError("Failed to copy Farcaster link. Try manually selecting the text.");
    }
  }, [farcasterMiniappUrl]);

  const handleJoinGame = useCallback(async () => {
    if (!playerSymbol?.value) {
      setError("Please select a valid symbol.");
      return;
    }
    setActionLoading(true);
    const toastId = toast.loading("Joining the lobby...");
    setTimeout(() => {
      setIsJoined(true);
      setGamePlayers(prev => [...prev, { address: "0xYOU", username: "You", symbol: playerSymbol.value }]);
      toast.update(toastId, {
        render: "Successfully joined the game!",
        type: "success",
        isLoading: false,
        autoClose: 5000,
      });
      setActionLoading(false);
    }, 1500);
  }, [playerSymbol]);

  const handleLeaveGame = useCallback(async () => {
    setActionLoading(true);
    setTimeout(() => {
      setIsJoined(false);
      setGamePlayers(prev => prev.filter((p: any) => p.address !== "0xYOU"));
      setPlayerSymbol(null);
      setActionLoading(false);
    }, 1000);
  }, []);

  const handleGoHome = useCallback(() => router.push("/"), [router]);

  if (loading || contractGameLoading) {
    return (
      <section className="w-full h-[calc(100dvh-87px)] flex items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-t-3 border-[#00F0FF] border-opacity-50"></div>
          <p className="text-[#00F0FF] text-lg font-semibold font-orbitron animate-pulse">
            Entering the Lobby...
          </p>
        </div>
      </section>
    );
  }

  if (error || !gamePlayers) {
    return (
      <section className="w-full h-[calc(100dvh-87px)] flex items-center justify-center bg-gray-900">
        <div className="space-y-3 text-center bg-[#0A1A1B]/80 p-6 rounded-xl shadow-lg border border-red-500/50">
          <p className="text-red-400 text-lg font-bold font-orbitron animate-pulse">
            {error ?? "Game Portal Closed"}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={() => router.push("/game-settings")}
              className="bg-[#00F0FF]/20 text-[#00F0FF] px-5 py-2 rounded-lg font-orbitron font-bold border border-[#00F0FF]/50 hover:bg-[#00F0FF]/30 transition-all shadow-md hover:shadow-[#00F0FF]/50"
            >
              Retry Join
            </button>
            <button
              type="button"
              onClick={handleGoHome}
              className="bg-[#00F0FF]/20 text-[#00F0FF] px-5 py-2 rounded-lg font-orbitron font-bold border border-[#00F0FF]/50 hover:bg-[#00F0FF]/30 transition-all shadow-md hover:shadow-[#00F0FF]/50"
            >
              Return to Base
            </button>
          </div>
        </div>
      </section>
    );
  }

  const playersJoinedCount = gamePlayers.length;
  const maxPlayersThreshold = DUMMY_GAME_CONFIG.maxPlayers;
  const showShareSection = true;

  return (
    <section className="w-full h-[calc(100dvh-87px)] bg-settings bg-cover bg-fixed bg-center">
      <main className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#010F10]/90 to-[#010F10]/50 px-4 sm:px-6">
        <div className="w-full max-w-xl bg-[#0A1A1B]/80 p-5 sm:p-6 rounded-2xl shadow-2xl border border-[#00F0FF]/50 backdrop-blur-md">
          <h2 className="text-2xl sm:text-3xl font-bold font-orbitron mb-6 text-[#F0F7F7] text-center tracking-widest bg-gradient-to-r from-[#00F0FF] to-[#FF00FF] bg-clip-text text-transparent animate-pulse">
            Tycoon Lobby
            <span className="block text-base text-[#00F0FF] mt-1 font-extrabold shadow-text">
              Code: {gameCode}
            </span>
          </h2>

          <div className="text-center space-y-3 mb-6">
            <p className="text-[#869298] text-sm font-semibold">
              {playersJoinedCount === maxPlayersThreshold
                ? "Full House! Game Starting Soon..."
                : "Assemble Your Rivals..."}
            </p>
            <div className="w-full bg-[#003B3E]/50 h-2 rounded-full overflow-hidden shadow-inner">
              <div
                className="bg-gradient-to-r from-[#00F0FF] to-[#00FFAA] h-full transition-all duration-500 ease-out"
                style={{ width: `${(playersJoinedCount / maxPlayersThreshold) * 100}%` }}
              ></div>
            </div>
            <p className="text-[#00F0FF] text-lg font-bold">
              Players Ready: {playersJoinedCount}/{maxPlayersThreshold}
            </p>
            <p className="text-yellow-400 text-lg font-bold flex items-center justify-center gap-2 animate-pulse">
                <FaCoins className="w-6 h-6" />
                Entry Stake: {DUMMY_GAME_CONFIG.stakeLabel}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 justify-center">
              {Array.from({ length: maxPlayersThreshold }).map((_, index: number) => {
                const player = gamePlayers[index];
                return (
                  <div
                    key={index}
                    className="bg-[#010F10]/70 p-3 rounded-lg border border-[#00F0FF]/30 flex flex-col items-center justify-center shadow-md hover:shadow-[#00F0FF]/50 transition-shadow duration-300"
                  >
                    <span className="text-4xl mb-1 animate-bounce-slow">
                      {player
                        ? SYMBOLS.find((s: PlayerSymbol) => s.value === player.symbol)?.emoji
                        : "❓"}
                    </span>
                    <p className="text-[#F0F7F7] text-xs font-semibold truncate max-w-[80px]">
                      {player?.username || "Slot Open"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {showShareSection && (
            <div className="mt-6 space-y-5 bg-[#010F10]/50 p-5 rounded-xl border border-[#00F0FF]/30 shadow-lg">
              <h3 className="text-lg font-bold text-[#00F0FF] text-center mb-3">
                Summon Allies!
              </h3>

              <div className="space-y-2">
                <p className="text-[#869298] text-xs text-center">Web Link</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    aria-label="game url"
                    value={gameUrl}
                    readOnly
                    className="w-full bg-[#0A1A1B] text-[#F0F7F7] p-2 rounded-lg border border-[#00F0FF]/50 focus:outline-none focus:ring-2 focus:ring-[#00F0FF] font-orbitron text-xs shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    disabled={actionLoading}
                    className="flex items-center justify-center bg-gradient-to-r from-[#00F0FF] to-[#00FFAA] text-black p-2 rounded-lg hover:opacity-90 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105"
                  >
                    <IoCopyOutline className="w-5 h-5" />
                  </button>
                </div>
                {copySuccess && (
                  <p className="text-green-400 text-xs text-center animate-fade-in">
                    {copySuccess}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-[#869298] text-xs text-center">Farcaster Miniapp Link</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    aria-label="farcaster miniapp url"
                    value={farcasterMiniappUrl}
                    readOnly
                    className="w-full bg-[#0A1A1B] text-[#F0F7F7] p-2 rounded-lg border border-[#00F0FF]/50 focus:outline-none focus:ring-2 focus:ring-[#00F0FF] font-orbitron text-xs shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={handleCopyFarcasterLink}
                    disabled={actionLoading}
                    className="flex items-center justify-center bg-gradient-to-r from-[#A100FF] to-[#00F0FF] text-white p-2 rounded-lg hover:opacity-90 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105"
                  >
                    <IoCopyOutline className="w-5 h-5" />
                  </button>
                </div>
                {copySuccessFarcaster && (
                  <p className="text-green-400 text-xs text-center animate-fade-in">
                    {copySuccessFarcaster}
                  </p>
                )}
              </div>

              <div className="flex justify-center gap-5 pt-3">
                <a
                  href={telegramShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center bg-[#0A1A1B] text-[#0FF0FC] p-3 rounded-full border border-[#00F0FF]/50 hover:bg-[#00F0FF]/20 transition-all duration-300 shadow-md hover:shadow-[#00F0FF]/50 transform hover:scale-110"
                >
                  <PiTelegramLogoLight className="w-6 h-6" />
                </a>
                <a
                  href={twitterShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center bg-[#0A1A1B] text-[#0FF0FC] p-3 rounded-full border border-[#00F0FF]/50 hover:bg-[#00F0FF]/20 transition-all duration-300 shadow-md hover:shadow-[#00F0FF]/50 transform hover:scale-110"
                >
                  <FaXTwitter className="w-6 h-6" />
                </a>
                <a
                  href={farcasterShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center bg-[#0A1A1B] text-[#0FF0FC] p-3 rounded-full border border-[#00F0FF]/50 hover:bg-[#00F0FF]/20 transition-all duration-300 shadow-md hover:shadow-[#00F0FF]/50 transform hover:scale-110"
                >
                  <SiFarcaster className="w-6 h-6" />
                </a>
              </div>
            </div>
          )}

          {!isJoined && (
            <div className="mt-6 space-y-5">
              <div className="flex flex-col bg-[#010F10]/50 p-5 rounded-xl border border-[#00F0FF]/30 shadow-lg">
                <label
                  htmlFor="symbol"
                  className="text-sm text-[#00F0FF] mb-1 font-orbitron font-bold"
                >
                  Pick Your Token
                </label>
                <select
                  id="symbol"
                  value={playerSymbol?.value ?? ""}
                  onChange={(e) => {
                    const selected = SYMBOLS.find((s: PlayerSymbol) => s.value === e.target.value);
                    setPlayerSymbol(selected ?? null);
                  }}
                  className="bg-[#0A1A1B] text-[#F0F7F7] p-2 rounded-lg border border-[#00F0FF]/50 focus:outline-none focus:ring-2 focus:ring-[#00F0FF] font-orbitron text-sm shadow-inner"
                >
                  <option value="" disabled>
                    Select Token
                  </option>
                  {availableSymbols.length > 0 ? (
                    availableSymbols.map((symbol: PlayerSymbol) => (
                      <option key={symbol.value} value={symbol.value}>
                        {symbol.emoji} {symbol.name}
                      </option>
                    ))
                  ) : (
                    <option disabled>No Tokens Left</option>
                  )}
                </select>
              </div>

              <button
                type="button"
                onClick={handleJoinGame}
                className="w-full bg-gradient-to-r from-[#00F0FF] to-[#FF00FF] text-black text-sm font-orbitron font-extrabold py-3 rounded-xl hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-[#00F0FF]/50 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!playerSymbol || actionLoading}
              >
                {actionLoading ? "Entering..." : "Join the Battle"}
              </button>
            </div>
          )}

          {isJoined && (
            <button
              type="button"
              onClick={handleLeaveGame}
              className="w-full mt-6 bg-gradient-to-r from-[#FF4D4D] to-[#FF00AA] text-white text-sm font-orbitron font-extrabold py-3 rounded-xl hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-red-500/50 transform hover:scale-105 disabled:opacity-50"
              disabled={actionLoading}
            >
              {actionLoading ? "Exiting..." : "Abandon Ship"}
            </button>
          )}

          <div className="flex justify-between mt-5 px-3">
            <button
              type="button"
              onClick={() => router.push("/game-settings")}
              className="text-[#0FF0FC] text-sm font-orbitron hover:text-[#00D4E6] transition-colors duration-200 hover:underline"
            >
              Switch Portal
            </button>
            <button
              type="button"
              onClick={handleGoHome}
              className="flex items-center text-[#0FF0FC] text-sm font-orbitron hover:text-[#00D4E6] transition-colors duration-200 hover:underline"
            >
              <IoHomeOutline className="mr-1 w-4 h-4" /> Back to HQ
            </button>
          </div>

          {error && (
            <p className="text-red-400 text-xs mt-3 text-center bg-red-900/50 p-2 rounded-lg animate-pulse">
              {error}
            </p>
          )}
        </div>
      </main>
    </section>
  );
}