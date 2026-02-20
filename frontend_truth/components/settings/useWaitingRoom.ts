"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccount, useChainId, useReadContract, usePublicClient } from "wagmi";
import { Address } from "viem";
import {
  useGetUsername,
  useJoinGame,
  useGetGameByCode,
  useApprove,
} from "@/context/ContractProvider";
import { apiClient } from "@/lib/api";
import { Game } from "@/lib/types/games";
import { getPlayerSymbolData, PlayerSymbol, symbols } from "@/lib/types/symbol";
import { ApiResponse } from "@/types/api";
import Erc20Abi from "@/context/abi/ERC20abi.json";
import { TYCOON_CONTRACT_ADDRESSES, USDC_TOKEN_ADDRESS } from "@/constants/contracts";
import { toast } from "react-toastify";
import { getContractErrorMessage } from "@/lib/utils/contractErrors";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { socketService } from "@/lib/socket";

const POLL_INTERVAL = 2000;
const SOCKET_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_SOCKET_URL ||
        (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, ""))
    : "";
const COPY_FEEDBACK_MS = 2000;
export const USDC_DECIMALS = 6;

export function useWaitingRoom() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawGameCode = searchParams.get("gameCode") ?? "";
  const gameCode = rawGameCode.trim().toUpperCase();

  const { address } = useAccount();
  const chainId = useChainId();
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;

  const [game, setGame] = useState<Game | null>(null);
  const [playerSymbol, setPlayerSymbol] = useState<PlayerSymbol | null>(null);
  const [availableSymbols, setAvailableSymbols] = useState<PlayerSymbol[]>(symbols);
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [copySuccessFarcaster, setCopySuccessFarcaster] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const {
    data: contractGame,
    isLoading: contractGameLoading,
    error: contractGameErrorRaw,
  } = useGetGameByCode(gameCode, { enabled: !!gameCode });

  // Filter out "Not found" errors - these are expected when game doesn't exist on-chain yet
  const contractGameError = useMemo(() => {
    if (!contractGameErrorRaw) return null;
    const errorMessage = contractGameErrorRaw?.message || String(contractGameErrorRaw);
    if (errorMessage.includes("Not found") || errorMessage.includes("not found")) {
      return null; // Don't show "Not found" errors - game might not be on-chain yet
    }
    return contractGameErrorRaw;
  }, [contractGameErrorRaw]);

  const contractId = contractGame?.id ?? null;
  const { data: username } = useGetUsername(address);
  const publicClient = usePublicClient();

  const contractAddress = TYCOON_CONTRACT_ADDRESSES[
    chainId as keyof typeof TYCOON_CONTRACT_ADDRESSES
  ] as Address | undefined;
  const usdcTokenAddress = USDC_TOKEN_ADDRESS[
    chainId as keyof typeof USDC_TOKEN_ADDRESS
  ] as Address | undefined;

  const { data: usdcAllowance, refetch: refetchAllowance } = useReadContract({
    address: usdcTokenAddress,
    abi: Erc20Abi,
    functionName: "allowance",
    args: address && contractAddress ? [address, contractAddress] : undefined,
    query: { enabled: !!address && !!usdcTokenAddress && !!contractAddress },
  });

  const {
    approve: approveUSDC,
    isPending: approvePending,
    isConfirming: approveConfirming,
  } = useApprove();

  const stakePerPlayer = contractGame?.stakePerPlayer
    ? BigInt(contractGame.stakePerPlayer)
    : BigInt(0);

  const guestCannotJoinStaked = !!guestUser && stakePerPlayer > BigInt(0);

  const {
    write: joinGame,
    isPending: isJoining,
    error: joinError,
  } = useJoinGame(
    contractId ? BigInt(contractId) : BigInt(0),
    username ?? "",
    playerSymbol?.value ?? "",
    gameCode,
    stakePerPlayer
  );

  const mountedRef = useRef(true);
  const refetchGameRef = useRef<{ fn: (() => Promise<void>) | null }>({ fn: null });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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

  const computeAvailableSymbols = useCallback((g: Game | null) => {
    if (!g) return symbols;
    const taken = new Set(g.players.map((p) => p.symbol));
    return symbols.filter((s) => !taken.has(s.value));
  }, []);

  const checkPlayerJoined = useCallback(
    (g: Game | null) => {
      if (!g) return false;
      const addr = guestUser?.address ?? address;
      if (!addr) return false;
      return g.players.some(
        (p) => String(p.address || "").toLowerCase() === addr.toLowerCase()
      );
    },
    [address, guestUser?.address]
  );

  const isCreator = useMemo(() => {
    if (!game) return false;
    const addr = guestUser?.address ?? address;
    if (!addr) return false;
    return addr.toLowerCase() === String(contractGame?.creator).toLowerCase();
  }, [game, address, guestUser?.address, contractGame?.creator]);

  const showShare = useMemo(() => {
    if (!game) return false;
    return game.players.length < game.number_of_players || isCreator;
  }, [game, isCreator]);

  const handleCopyLink = useCallback(async () => {
    if (!gameUrl) {
      setError("No shareable URL available.");
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
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
      if (navigator.clipboard?.writeText) {
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

  useEffect(() => {
    if (!gameCode) {
      setError("No game code provided. Please enter a valid game code.");
      setLoading(false);
      return;
    }

    let pollTimer: number | null = null;

    const fetchOnce = async () => {
      setError(null);
      try {
        const res = await apiClient.get<ApiResponse>(
          `/games/code/${encodeURIComponent(gameCode)}`
        );

        if (!mountedRef.current) return;

        if (!res?.data?.success || !res?.data?.data) {
          throw new Error(`Game ${gameCode} not found`);
        }

        const gameData = res.data.data;

        if (gameData.status === "RUNNING") {
          router.push(`/game-play?gameCode=${encodeURIComponent(gameCode)}`);
          return;
        }

        if (gameData.status !== "PENDING") {
          throw new Error(`Game ${gameCode} is not open for joining.`);
        }

        setGame(gameData);
        setAvailableSymbols(computeAvailableSymbols(gameData));
        setIsJoined(checkPlayerJoined(gameData));

        if (gameData.players.length === gameData.number_of_players) {
          const updateRes = await apiClient.put<ApiResponse>(`/games/${gameData.id}`, {
            status: "RUNNING",
          });
          if (updateRes?.data?.success)
            router.push(`/game-play?gameCode=${gameCode}`);
        }
      } catch (err: unknown) {
        if (!mountedRef.current) return;
        if ((err as Error)?.name === "AbortError") return;
        console.error("fetchGame error:", err);
        setError(
          (err as Error)?.message ?? "Failed to fetch game data. Please try again."
        );
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };

    refetchGameRef.current.fn = fetchOnce;

    const startPolling = async () => {
      await fetchOnce();
      const tick = async () => {
        if (typeof document !== "undefined" && document.hidden) {
          pollTimer = window.setTimeout(tick, POLL_INTERVAL);
          return;
        }
        await fetchOnce();
        pollTimer = window.setTimeout(tick, POLL_INTERVAL);
      };
      pollTimer = window.setTimeout(tick, POLL_INTERVAL);
    };

    startPolling();

    return () => {
      refetchGameRef.current.fn = null;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [gameCode, computeAvailableSymbols, checkPlayerJoined, router]);

  // Socket: refetch immediately when someone joins (game-update / player-joined)
  useEffect(() => {
    if (!gameCode || !SOCKET_URL) return;
    const socket = socketService.connect(SOCKET_URL);
    socketService.joinGameRoom(gameCode);
    const onGameUpdate = (data: { gameCode?: string }) => {
      if (data?.gameCode === gameCode) refetchGameRef.current.fn?.();
    };
    const onPlayerJoined = () => {
      refetchGameRef.current.fn?.();
    };
    socketService.onGameUpdate(onGameUpdate);
    socketService.onPlayerJoined(onPlayerJoined);
    return () => {
      socketService.removeListener("game-update", onGameUpdate);
      socketService.removeListener("player-joined", onPlayerJoined);
      socketService.leaveGameRoom(gameCode);
    };
  }, [gameCode]);

  const playersJoined =
    contractGame?.joinedPlayers
      ? Number(contractGame.joinedPlayers)
      : (game?.players.length ?? 0);
  const maxPlayers =
    contractGame?.numberOfPlayers
      ? Number(contractGame.numberOfPlayers)
      : (game?.number_of_players ?? 0);

  const handleJoinGame = useCallback(async () => {
    if (!game) {
      setError("No game data found. Please enter a valid game code.");
      return;
    }

    if (
      !playerSymbol?.value ||
      !availableSymbols.some((s) => s.value === playerSymbol.value)
    ) {
      setError("Please select a valid symbol.");
      return;
    }

    if (game.players.length >= game.number_of_players) {
      setError("Game is full!");
      return;
    }

    // No wallet and not signed in as guest: direct to sign in as guest (free) or connect wallet (staked)
    const hasWalletOrGuest = !!address || !!guestUser;
    if (!hasWalletOrGuest) {
      const isFree = stakePerPlayer === BigInt(0);
      setError(
        isFree
          ? "Sign in as guest to join this free game. Go to Join Room and sign in as guest, then return here."
          : "Connect a wallet or sign in as guest to join. Staked games require a connected wallet."
      );
      return;
    }

    setActionLoading(true);
    setError(null);
    const toastId = toast.loading("Joining the game...");

    if (guestUser) {
      if (stakePerPlayer > BigInt(0)) {
        setError("Guests cannot join staked games. Connect a wallet to join this game.");
        setActionLoading(false);
        toast.update(toastId, {
          render: "Guests cannot join staked games. Connect a wallet to join.",
          type: "error",
          isLoading: false,
          autoClose: 6000,
        });
        return;
      }
      try {
        await apiClient.post("/games/join-as-guest", {
          code: game.code,
          symbol: playerSymbol.value,
          joinCode: game.code,
        });
        if (mountedRef.current) {
          setIsJoined(true);
          setError(null);
        }
        toast.update(toastId, {
          render: "Successfully joined the game!",
          type: "success",
          isLoading: false,
          autoClose: 5000,
        });
      } catch (err: unknown) {
        const message = (err as any)?.response?.data?.message ?? (err as Error)?.message ?? "Failed to join game.";
        setError(message);
        toast.update(toastId, { render: message, type: "error", isLoading: false, autoClose: 8000 });
      } finally {
        if (mountedRef.current) setActionLoading(false);
      }
      return;
    }

    if (!contractAddress) {
      setError("Contract not deployed on this network.");
      setActionLoading(false);
      toast.dismiss(toastId);
      return;
    }

    if (contractId == null || Number(contractId) === 0) {
      setError("Game not found on-chain. Make sure you're on the correct network, or the game may still be creating.");
      setActionLoading(false);
      toast.dismiss(toastId);
      return;
    }

    if (!usdcTokenAddress && stakePerPlayer > 0) {
      setError("USDC not available on this network.");
      setActionLoading(false);
      toast.dismiss(toastId);
      return;
    }

    try {
      if (stakePerPlayer > 0) {
        toast.update(toastId, { render: "Checking USDC approval..." });
        await refetchAllowance();
        const currentAllowance = usdcAllowance
          ? BigInt(usdcAllowance.toString())
          : BigInt(0);

        if (currentAllowance < stakePerPlayer) {
          toast.update(toastId, { render: "Approving USDC spend..." });
          await approveUSDC(usdcTokenAddress!, contractAddress, stakePerPlayer);
          await new Promise((r) => setTimeout(r, 3000));
        }
      }

      toast.update(toastId, { render: "Joining game on-chain (sign in wallet)..." });
      const hash = await joinGame();

      if (hash && publicClient) {
        toast.update(toastId, { render: "Waiting for confirmation..." });
        await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
      }

      toast.update(toastId, { render: "Saving join to server..." });
      const res = await apiClient.post<ApiResponse>("/game-players/join", {
        address,
        symbol: playerSymbol.value,
        code: game.code,
      });

      if (res?.data?.success === false) {
        throw new Error(res?.data?.message ?? "Failed to join game");
      }

      if (mountedRef.current) {
        setIsJoined(true);
        setError(null);
      }

      toast.update(toastId, {
        render: "Successfully joined the game!",
        type: "success",
        isLoading: false,
        autoClose: 5000,
      });
    } catch (err: unknown) {
      console.error("join error", err);
      const message = getContractErrorMessage(err, "Failed to join game. Please try again.");
      setError(message);
      toast.update(toastId, {
        render: message,
        type: "error",
        isLoading: false,
        autoClose: 8000,
      });
    } finally {
      if (mountedRef.current) setActionLoading(false);
    }
  }, [
    game,
    playerSymbol,
    availableSymbols,
    address,
    guestUser,
    joinGame,
    stakePerPlayer,
    contractId,
    contractAddress,
    usdcTokenAddress,
    refetchAllowance,
    usdcAllowance,
    approveUSDC,
    publicClient,
  ]);

  const handleLeaveGame = useCallback(async () => {
    if (!game)
      return setError("No game data found. Please enter a valid game code.");
    setActionLoading(true);
    setError(null);
    try {
      const res = await apiClient.post<ApiResponse>("/game-players/leave", {
        address,
        code: game.code,
      });
      if (res?.data?.success === false)
        throw new Error(res?.data?.message ?? "Failed to leave game");
      if (mountedRef.current) {
        setIsJoined(false);
        setPlayerSymbol(null);
      }
    } catch (err: unknown) {
      console.error("leave error", err);
      if (mountedRef.current)
        setError(
          (err as Error)?.message ?? "Failed to leave game. Please try again."
        );
    } finally {
      if (mountedRef.current) setActionLoading(false);
    }
  }, [game, address]);

  const handleGoHome = useCallback(() => router.push("/"), [router]);

  return {
    router,
    gameCode,
    game,
    setGame,
    playerSymbol,
    setPlayerSymbol,
    availableSymbols,
    isJoined,
    copySuccess,
    copySuccessFarcaster,
    error,
    setError,
    loading,
    actionLoading,
    contractGame,
    contractGameLoading,
    contractGameError,
    contractId,
    username,
    contractAddress,
    usdcTokenAddress,
    usdcAllowance,
    refetchAllowance,
    approveUSDC,
    approvePending,
    approveConfirming,
    stakePerPlayer,
    guestCannotJoinStaked,
    guestUser,
    joinGame,
    isJoining,
    joinError,
    gameUrl,
    farcasterMiniappUrl,
    shareText,
    farcasterShareText,
    telegramShareUrl,
    twitterShareUrl,
    farcasterShareUrl,
    computeAvailableSymbols,
    checkPlayerJoined,
    isCreator,
    showShare,
    handleCopyLink,
    handleCopyFarcasterLink,
    playersJoined,
    maxPlayers,
    handleJoinGame,
    handleLeaveGame,
    handleGoHome,
    getPlayerSymbolData,
    symbols,
  };
}
