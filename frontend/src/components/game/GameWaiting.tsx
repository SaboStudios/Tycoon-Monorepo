"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Copy,
  Home,
  Coins,
  Share2,
  Send,
  MessageCircle,
  Users,
  Loader2,
} from "lucide-react";
import { toast } from "react-toastify";
import { useMediaQuery } from "react-responsive";
import { GameWaitingDesktop } from "./GameWaitingDesktop";
import { GameWaitingMobile } from "./GameWaitingMobile";

// --- TYPES ---
export interface PlayerSymbol {
  name: string;
  value: string;
  emoji: string;
}

export interface StatusMessage {
  id: string;
  text: string;
  timestamp: Date;
  type: "info" | "join" | "leave" | "system";
}

export interface GamePlayer {
  address: string;
  username: string;
  symbol: string;
}

// --- CONSTANTS ---
const SYMBOLS: PlayerSymbol[] = [
  { name: "Ship", value: "ship", emoji: "🚢" },
  { name: "Car", value: "car", emoji: "🚗" },
  { name: "Plane", value: "plane", emoji: "✈️" },
  { name: "Truck", value: "truck", emoji: "🚚" },
];

const MOCK_STATUS_MESSAGES: StatusMessage[] = [
  { id: "1", text: "Lobby created. Waiting for players...", timestamp: new Date(), type: "system" },
  { id: "2", text: "Player1 joined the lobby", timestamp: new Date(), type: "join" },
  { id: "3", text: "Player2 joined the lobby", timestamp: new Date(), type: "join" },
];

const COPY_FEEDBACK_MS = 2000;
const MOCK_AUTO_START_SECONDS = 60; // Countdown for demo
const MIN_PLAYERS_TO_START = 2;

// --- MOCK DATA ---
const DUMMY_PLAYERS: GamePlayer[] = [
  { address: "0x123...abc", username: "Player1", symbol: "ship" },
  { address: "0x456...def", username: "Player2", symbol: "car" },
];

const DUMMY_GAME_CONFIG = {
  code: "TYCOON",
  maxPlayers: 4,
  stakeLabel: "10 USDC",
  stakeValue: BigInt("10000000"),
};

/**
 * Game waiting lobby component.
 * Renders: player list, game code, start button, chat/status messages, share links.
 * Uses mock data for demonstration. Tycoon colors (#00F0FF, #010F10).
 */
export default function GameWaiting(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawGameCode = searchParams.get("gameCode") ?? DUMMY_GAME_CONFIG.code;
  const gameCode = rawGameCode.trim().toUpperCase();

  const [gamePlayers, setGamePlayers] = useState<GamePlayer[]>(DUMMY_PLAYERS);
  const [playerSymbol, setPlayerSymbol] = useState<PlayerSymbol | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [copySuccessFarcaster, setCopySuccessFarcaster] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [contractGameLoading, setContractGameLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [countdown, setCountdown] = useState(MOCK_AUTO_START_SECONDS);
  const [statusMessages, setStatusMessages] = useState<StatusMessage[]>(MOCK_STATUS_MESSAGES);
  const isHost = true; // Mock: current user is host

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

  // Mock countdown timer for auto-start
  useEffect(() => {
    if (!mountedRef.current || loading) return;
    const interval = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [loading]);

  const availableSymbols = useMemo(() => {
    const taken = new Set(gamePlayers.map((p) => p.symbol));
    return SYMBOLS.filter((s) => !taken.has(s.value));
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
      `https://t.me/share/url?url=${encodeURIComponent(gameUrl)}&text=${encodeURIComponent(shareText)}`,
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

  const canStartGame = useMemo(() => {
    return gamePlayers.length >= MIN_PLAYERS_TO_START && isHost;
  }, [gamePlayers.length, isHost]);

  // Responsive MediaQuery
  const isMobile = useMediaQuery({ query: "(max-width: 768px)" });

  // Handler functions
  const handleCopyLink = useCallback(async () => {
    if (!gameUrl) {
      setError("No shareable URL available.");
      return;
    }
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
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
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
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
      setError("Failed to copy Farcaster link.");
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
      setGamePlayers((prev: GamePlayer[]) => [
        ...prev,
        { address: "0xYOU", username: "You", symbol: playerSymbol.value },
      ]);
      setStatusMessages((prev: StatusMessage[]) => [
        ...prev,
        { id: `join-${Date.now()}`, text: "You joined the lobby", timestamp: new Date(), type: "join" },
      ]);
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
      setGamePlayers((prev: GamePlayer[]) => prev.filter((p: GamePlayer) => p.address !== "0xYOU"));
      setPlayerSymbol(null);
      setActionLoading(false);
    }, 1000);
  }, []);

  const handleStartGame = useCallback(() => {
    if (!canStartGame) return;
    toast.success("Starting game...");
    // In real app: navigate to game room or trigger contract
  }, [canStartGame]);

  const handleGoHome = useCallback(() => router.push("/"), [router]);
  const navigateToSettings = useCallback(() => router.push("/game-settings"), [router]);

  const commonProps = {
    gameCode,
    gamePlayers,
    playerSymbol,
    isJoined,
    copySuccess,
    copySuccessFarcaster,
    error,
    loading,
    contractGameLoading,
    actionLoading,
    countdown,
    statusMessages,
    isHost,
    SYMBOLS,
    DUMMY_GAME_CONFIG,
    gameUrl,
    farcasterMiniappUrl,
    telegramShareUrl,
    twitterShareUrl,
    farcasterShareUrl,
    canStartGame,
    availableSymbols,
    playersJoinedCount: gamePlayers.length,
    maxPlayersThreshold: DUMMY_GAME_CONFIG.maxPlayers,
    setPlayerSymbol,
    handleCopyLink,
    handleCopyFarcasterLink,
    handleJoinGame,
    handleLeaveGame,
    handleStartGame,
    handleGoHome,
    navigateToSettings,
  };

  // Return Mobile view if screen is <= 768px
  if (isMobile) {
    return <GameWaitingMobile {...commonProps} />;
  }

  // Otherwise return Desktop view
  return <GameWaitingDesktop {...commonProps} />;
}
