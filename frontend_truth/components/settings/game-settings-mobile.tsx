"use client";

import React, { useState } from "react";
import { FaUsers, FaUser, FaCoins, FaBrain } from "react-icons/fa6";
import { House } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/game-switch";
import { MdPrivateConnectivity } from "react-icons/md";
import { RiAuctionFill } from "react-icons/ri";
import { GiBank, GiPrisoner } from "react-icons/gi";
import { IoBuild } from "react-icons/io5";
import { FaRandom } from "react-icons/fa";
import { useRouter } from "next/navigation";
import {
  useAccount,
  useChainId,
  useReadContract,
} from 'wagmi';
import { useAppKitNetwork } from '@reown/appkit/react';
import { toast } from "react-toastify";
import { generateGameCode } from "@/lib/utils/games";
import { GamePieces } from "@/lib/constants/games";
import { apiClient } from "@/lib/api";
import Erc20Abi from '@/context/abi/ERC20abi.json';
import {
  useIsRegistered,
  useGetUsername,
  useCreateGame,
  useApprove,
} from "@/context/ContractProvider";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { TYCOON_CONTRACT_ADDRESSES, USDC_TOKEN_ADDRESS, MINIPAY_CHAIN_IDS } from "@/constants/contracts";
import { Address, parseUnits } from "viem";
import { getContractErrorMessage } from "@/lib/utils/contractErrors";

interface GameCreateResponse {
  data?: {
    data?: { id: string | number };
    id?: string | number;
  };
  id?: string | number;
  [key: string]: any;
}

const USDC_DECIMALS = 6;
const stakePresets = [1, 5, 10, 25, 50, 100];

export default function CreateGameMobile() {
  const router = useRouter();
  const { address } = useAccount();
  const wagmiChainId = useChainId();
  const { caipNetwork } = useAppKitNetwork();
  const guestAuth = useGuestAuthOptional();
  const isGuest = !!guestAuth?.guestUser;

  const { data: username } = useGetUsername(address);
  const { data: isUserRegistered, isLoading: isRegisteredLoading } = useIsRegistered(address);

  const isMiniPay = MINIPAY_CHAIN_IDS.includes(wagmiChainId);
  const chainName = caipNetwork?.name?.toLowerCase().replace(" ", "") || `chain-${wagmiChainId}` || "unknown";

  const [isFreeGame, setIsFreeGame] = useState(false);
  const [isStarting, setIsStarting] = useState(false); // prevents double clicks

  const [settings, setSettings] = useState({
    symbol: "hat",
    maxPlayers: 2,
    privateRoom: true,
    auction: true,
    rentInPrison: false,
    mortgage: true,
    evenBuild: true,
    randomPlayOrder: true,
    startingCash: 1500,
    stake: 10,
    duration: 10,
  });

  const [customStake, setCustomStake] = useState<string>("");

  const contractAddress = TYCOON_CONTRACT_ADDRESSES[wagmiChainId as keyof typeof TYCOON_CONTRACT_ADDRESSES] as Address | undefined;
  const usdcTokenAddress = USDC_TOKEN_ADDRESS[wagmiChainId as keyof typeof USDC_TOKEN_ADDRESS] as Address | undefined;

  const { data: usdcAllowance, refetch: refetchAllowance } = useReadContract({
    address: usdcTokenAddress,
    abi: Erc20Abi,
    functionName: 'allowance',
    args: address && contractAddress ? [address, contractAddress] : undefined,
    query: { enabled: !!address && !!usdcTokenAddress && !!contractAddress && !isFreeGame },
  });

  const gameCode = generateGameCode();
  const gameType = settings.privateRoom ? "PRIVATE" : "PUBLIC";

  const {
    approve: approveUSDC,
    isPending: approvePending,
    isConfirming: approveConfirming,
  } = useApprove();

  const finalStake = isFreeGame ? 0 : settings.stake;
  const stakeAmount = parseUnits(finalStake.toString(), USDC_DECIMALS);

  const { write: createGame, isPending: isCreatePending } = useCreateGame(
    username || "",
    gameType,
    settings.symbol,
    settings.maxPlayers,
    gameCode,
    BigInt(settings.startingCash),
    stakeAmount
  );

  const handleStakeSelect = (value: number) => {
    if (isFreeGame) return;
    setSettings((prev) => ({ ...prev, stake: value }));
    setCustomStake("");
  };

  const handleCustomStake = (value: string) => {
    if (isFreeGame) return;
    setCustomStake(value);
    const num = Number(value);
    if (!isNaN(num) && num >= 0.01) {
      setSettings((prev) => ({ ...prev, stake: num }));
    }
  };

  const extractGameId = (response: any): string | number | undefined => {
    if (typeof response === 'string' || typeof response === 'number') return response;
    return (
      response?.data?.data?.id ??
      response?.data?.id ??
      response?.id ??
      response?.gameId ??
      response?.data?.game?.id
    );
  };

  const handlePlay = async () => {
    if (isStarting) return;
    setIsStarting(true);
    const toastId = toast.loading("Preparing game...");

    if (isGuest) {
      try {
        toast.update(toastId, { render: "Creating game (guest)..." });
        const res = await apiClient.post<any>("/games/create-as-guest", {
          code: gameCode,
          mode: gameType,
          symbol: settings.symbol,
          number_of_players: settings.maxPlayers,
          stake: 0,
          starting_cash: settings.startingCash,
          is_ai: false,
          is_minipay: isMiniPay,
          chain: chainName,
          duration: settings.duration,
          use_usdc: false,
          settings: {
            auction: settings.auction,
            rent_in_prison: settings.rentInPrison,
            mortgage: settings.mortgage,
            even_build: settings.evenBuild,
            randomize_play_order: settings.randomPlayOrder,
            starting_cash: settings.startingCash,
          },
        });
        const data = (res as any)?.data;
        const dbGameId = data?.data?.id ?? data?.id;
        if (!dbGameId) throw new Error("Backend did not return game ID");
        toast.update(toastId, {
          render: `Game created! Code: ${gameCode}`,
          type: "success",
          isLoading: false,
          autoClose: 5000,
          onClose: () => router.push(`/game-waiting?gameCode=${gameCode}`),
        });
      } catch (err: any) {
        const msg = err?.response?.data?.message ?? err?.message ?? "Failed to create game.";
        toast.update(toastId, { render: msg, type: "error", isLoading: false, autoClose: 8000 });
      }
      setIsStarting(false);
      return;
    }

    if (!address || !username || !isUserRegistered) {
      toast.error("Connect wallet & register first!", { autoClose: 5000 });
      setIsStarting(false);
      return;
    }

    if (!contractAddress) {
      toast.error("Game contract not available on this network.");
      setIsStarting(false);
      return;
    }

    if (!isFreeGame && !usdcTokenAddress) {
      toast.error("USDC not supported on current network.");
      setIsStarting(false);
      return;
    }

    try {
      if (!isFreeGame) {
        toast.update(toastId, { render: "Checking USDC allowance..." });
        await refetchAllowance();

        const allowance = usdcAllowance ? BigInt(usdcAllowance.toString()) : 0;
        if (allowance < stakeAmount) {
          toast.update(toastId, { render: "Approving USDC (one-time)..." });
          await approveUSDC(usdcTokenAddress!, contractAddress, stakeAmount);

          await new Promise(r => setTimeout(r, 4000));
          await refetchAllowance();
        }
      }

      toast.update(toastId, { render: "Creating game on-chain..." });
      const onChainGameId = await createGame();
      if (!onChainGameId) throw new Error("No game ID received from contract");

      toast.update(toastId, { render: "Saving game to server..." });

      const saveRes = await apiClient.post<any>("/games", {
        id: onChainGameId.toString(),
        code: gameCode,
        mode: gameType,
        address,
        symbol: settings.symbol,
        number_of_players: settings.maxPlayers,
        stake: finalStake,
        starting_cash: settings.startingCash,
        is_ai: false,
        is_minipay: isMiniPay,
        chain: chainName,
        duration: settings.duration,
        use_usdc: !isFreeGame,
        settings: {
          auction: settings.auction,
          rent_in_prison: settings.rentInPrison,
          mortgage: settings.mortgage,
          even_build: settings.evenBuild,
          randomize_play_order: settings.randomPlayOrder,
        },
      });

      const dbGameId = extractGameId(saveRes);

      if (!dbGameId) {
        console.error("Backend response without ID:", JSON.stringify(saveRes, null, 2));
        throw new Error("Server didn't return game ID");
      }

      toast.update(toastId, {
        render: `Game created! Code: ${gameCode}`,
        type: "success",
        isLoading: false,
        autoClose: 5000,
        onClose: () => router.push(`/game-waiting?gameCode=${gameCode}`),
      });
    } catch (err: any) {
      console.error("Game creation failed:", err);

      const message = getContractErrorMessage(err, "Failed to create game. Try again.");

      toast.update(toastId, {
        render: message,
        type: "error",
        isLoading: false,
        autoClose: 9000,
      });
    } finally {
      setIsStarting(false);
    }
  };

  const canCreate = isGuest || (address && username && isUserRegistered);

  if (!isGuest && isRegisteredLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-settings bg-cover">
        <p className="text-[#00F0FF] text-3xl font-orbitron animate-pulse text-center px-8">
          LOADING ARENA...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-settings bg-cover bg-fixed flex flex-col pb-10 pt-[70px]">
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex justify-between items-center">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition"
          >
            <House className="w-5 h-5" />
            <span className="font-bold text-sm">BACK</span>
          </button>
          <h1 className="text-2xl font-orbitron font-extrabold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
            CREATE
          </h1>
          <div className="w-14" />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 px-5 space-y-4 pb-6 overflow-y-auto">
        {/* Free Game Toggle - hidden for guests (guest games are free only) */}
        {!isGuest && (
        <div className="bg-black/65 rounded-xl p-4 border border-yellow-600/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FaCoins className="w-5 h-5 text-yellow-400" />
              <div>
                <h3 className="text-sm font-bold text-yellow-300">Free Game</h3>
                <p className="text-gray-400 text-[10px]">No entry fee • Pure fun</p>
              </div>
            </div>
            <Switch
              checked={isFreeGame}
              onCheckedChange={(checked) => {
                setIsFreeGame(checked);
                if (checked) {
                  setSettings(p => ({ ...p, stake: 0 }));
                  setCustomStake("0");
                }
              }}
            />
          </div>
        </div>
        )}
        {isGuest && (
          <div className="bg-black/65 rounded-xl p-4 border border-yellow-600/40">
            <div className="flex items-center gap-2">
              <FaCoins className="w-5 h-5 text-yellow-400" />
              <div>
                <h3 className="text-sm font-bold text-yellow-300">Guest games are free</h3>
                <p className="text-gray-400 text-[10px]">Connect a wallet to create staked games</p>
              </div>
            </div>
          </div>
        )}

        {/* Your Piece & Max Players - compact row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-cyan-900/35 to-blue-900/35 rounded-xl p-4 border border-cyan-500/25">
            <div className="flex items-center gap-2 mb-2">
              <FaUser className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-cyan-300">Your Piece</h3>
            </div>
            <Select value={settings.symbol} onValueChange={(v) => setSettings(p => ({ ...p, symbol: v }))}>
              <SelectTrigger className="h-10 bg-black/60 border-cyan-500/30 text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GamePieces.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-gradient-to-br from-purple-900/35 to-pink-900/35 rounded-xl p-4 border border-purple-500/25">
            <div className="flex items-center gap-2 mb-2">
              <FaUsers className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-bold text-purple-300">Players</h3>
            </div>
            <Select value={settings.maxPlayers.toString()} onValueChange={(v) => setSettings(p => ({ ...p, maxPlayers: +v }))}>
              <SelectTrigger className="h-10 bg-black/60 border-purple-500/30 text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2,3,4,5,6,7,8].map(n => (
                  <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Private Room */}
        <div className="bg-black/60 rounded-xl p-4 border border-gray-600/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MdPrivateConnectivity className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Private</h3>
                <p className="text-gray-400 text-[10px]">Code only</p>
              </div>
            </div>
            <Switch
              checked={settings.privateRoom}
              onCheckedChange={(v) => setSettings(p => ({ ...p, privateRoom: v }))}
            />
          </div>
        </div>

        {/* Stake - hidden for guests */}
        {!isGuest && (
        <div className={`bg-gradient-to-b from-green-900/55 to-emerald-900/55 rounded-xl p-4 border ${isFreeGame ? 'border-yellow-600/40 opacity-75' : 'border-green-500/40'}`}>
          <div className="flex items-center gap-2 mb-3">
            <FaCoins className="w-5 h-5 text-green-400" />
            <h3 className="text-sm font-bold text-green-300">Entry Stake</h3>
          </div>

          {isFreeGame ? (
            <div className="py-6 text-center">
              <p className="text-3xl font-black text-yellow-400 mb-1">FREE</p>
              <p className="text-green-300 text-sm">No crypto needed</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {stakePresets.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => handleStakeSelect(amt)}
                    className={`py-2 rounded-lg font-bold text-xs transition-all active:scale-95 ${
                      settings.stake === amt
                        ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-black shadow"
                        : "bg-black/65 border border-gray-600 text-gray-300"
                    }`}
                  >
                    {amt}
                  </button>
                ))}
              </div>

              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Custom ≥ 0.01"
                value={customStake}
                onChange={(e) => handleCustomStake(e.target.value)}
                className="w-full px-3 py-2.5 bg-black/60 border border-green-500/50 rounded-lg text-white text-center text-sm focus:outline-none focus:border-green-400 mb-3"
              />

              <div className="text-center">
                <p className="text-xs text-gray-400">Current Stake</p>
                <p className="text-xl font-bold text-green-400">
                  {settings.stake} USDC
                </p>
              </div>
            </>
          )}
        </div>
        )}

        {/* Starting Cash & Duration */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-amber-900/35 to-orange-900/35 rounded-xl p-4 border border-amber-500/25">
            <div className="flex items-center gap-2 mb-2">
              <FaCoins className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-amber-300">Cash</h3>
            </div>
            <Select value={settings.startingCash.toString()} onValueChange={(v) => setSettings(p => ({ ...p, startingCash: +v }))}>
              <SelectTrigger className="h-10 bg-black/60 border-amber-500/30 text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="500">$500</SelectItem>
                <SelectItem value="1500">$1,500</SelectItem>
                <SelectItem value="2000">$2,000</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-gradient-to-br from-indigo-900/35 to-purple-900/35 rounded-xl p-4 border border-indigo-500/25">
            <div className="flex items-center gap-2 mb-2">
              <FaBrain className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-indigo-300">Time</h3>
            </div>
            <Select value={settings.duration.toString()} onValueChange={(v) => setSettings(p => ({ ...p, duration: +v }))}>
              <SelectTrigger className="h-10 bg-black/60 border-indigo-500/30 text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2m</SelectItem>
                <SelectItem value="10">10m</SelectItem>
                <SelectItem value="30">30m</SelectItem>
                <SelectItem value="60">60m</SelectItem>
                <SelectItem value="90">90m</SelectItem>
                <SelectItem value="0">∞</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* House Rules */}
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
                  onCheckedChange={(v) => setSettings(p => ({ ...p, [item.key]: v }))}
                />
              </div>
            ))}
          </div>
        </div>

        {/* CREATE BUTTON */}
        <div className="pt-4 pb-6">
          <button
            onClick={handlePlay}
            disabled={!canCreate || isStarting || (!isGuest && (isCreatePending || approvePending || approveConfirming))}
            className="w-full py-4 text-lg font-orbitron font-bold tracking-wide
                       bg-gradient-to-r from-cyan-600 via-purple-700 to-pink-600
                       hover:brightness-110 active:scale-[0.98]
                       rounded-xl shadow-lg transition-all duration-300
                       disabled:opacity-60 disabled:cursor-not-allowed border-2 border-white/10 text-white"
          >
            {isStarting || (!isGuest && (approvePending || approveConfirming))
              ? "PROCESSING..."
              : !isGuest && isCreatePending
              ? "CREATING..."
              : isFreeGame
              ? "START FREE GAME"
              : "CREATE GAME"}
          </button>
        </div>
      </div>
    </div>
  );
}