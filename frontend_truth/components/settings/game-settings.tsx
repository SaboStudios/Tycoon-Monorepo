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
}

const USDC_DECIMALS = 6;
const stakePresets = [1, 5, 10, 25, 50, 100];

export default function GameSettings() {
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
    query: { enabled: !!address && !!usdcTokenAddress && !!contractAddress },
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
    const min = 0.01;
    if (!isNaN(num) && num >= min) {
      setSettings((prev) => ({ ...prev, stake: num }));
    }
  };

  const handlePlay = async () => {
    if (isGuest) {
      const toastId = toast.loading("Creating your game room...");
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
          render: `Game created! Share code: ${gameCode}`,
          type: "success",
          isLoading: false,
          autoClose: 5000,
          onClose: () => router.push(`/game-waiting?gameCode=${gameCode}`),
        });
      } catch (err: any) {
        const msg = err?.response?.data?.message || err?.message || "Failed to create game";
        toast.update(toastId, { render: msg, type: "error", isLoading: false, autoClose: 8000 });
      }
      return;
    }

    if (!address || !username || !isUserRegistered) {
      toast.error("Please connect wallet and register first!", { autoClose: 5000 });
      return;
    }

    if (!contractAddress) {
      toast.error("Contract not deployed on this network.");
      return;
    }

    if (!usdcTokenAddress && !isFreeGame) {
      toast.error("USDC not available on this network.");
      return;
    }

    const toastId = toast.loading("Creating your game room...");

    try {
      if (!isFreeGame) {
        let needsApproval = false;
        await refetchAllowance();
        const currentAllowance = usdcAllowance ? BigInt(usdcAllowance.toString()) : BigInt(0);
        if (currentAllowance < stakeAmount) needsApproval = true;

        if (needsApproval) {
          toast.update(toastId, { render: "Approving USDC spend..." });
          await approveUSDC(usdcTokenAddress!, contractAddress, stakeAmount);
          await new Promise(r => setTimeout(r, 3000));
        }
      }

      toast.update(toastId, { render: "Creating game on-chain..." });
      const onChainGameId = await createGame();
      if (!onChainGameId) throw new Error("Failed to create game on-chain");

      toast.update(toastId, { render: "Saving game to server..." });

      let dbGameId: string | number | undefined;
      try {
        const saveRes: GameCreateResponse = await apiClient.post<any>("/games", {
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

        dbGameId =
          typeof saveRes === 'string' || typeof saveRes === 'number'
            ? saveRes
            : saveRes?.data?.data?.id ?? saveRes?.data?.id ?? saveRes?.id;

        if (!dbGameId) throw new Error("Backend did not return game ID");
      } catch (err: any) {
        throw new Error(err.response?.data?.message || "Failed to save game");
      }

      toast.update(toastId, {
        render: `Game created! Share code: ${gameCode}`,
        type: "success",
        isLoading: false,
        autoClose: 5000,
        onClose: () => router.push(`/game-waiting?gameCode=${gameCode}`),
      });
    } catch (err: any) {
      console.error("Create game error:", err);
      const message = getContractErrorMessage(err, "Failed to create game. Please try again.");

      toast.update(toastId, {
        render: message,
        type: "error",
        isLoading: false,
        autoClose: 8000,
      });
    }
  };

  if (!isGuest && isRegisteredLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-settings bg-cover">
        <p className="text-[#00F0FF] text-4xl font-orbitron animate-pulse tracking-wider">
          LOADING ARENA...
        </p>
      </div>
    );
  }

  const canCreate = isGuest || (address && username && isUserRegistered);

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
            CREATE GAME
          </h1>
          <div className="w-24" />
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-8 mb-10">
          {/* Column 1 */}
          <div className="space-y-6">
            {/* Your Piece */}
            <div className="bg-gradient-to-br from-cyan-900/40 to-blue-900/40 rounded-2xl p-6 border border-cyan-500/30">
              <div className="flex items-center gap-3 mb-4">
                <FaUser className="w-7 h-7 text-cyan-400" />
                <h3 className="text-xl font-bold text-cyan-300">Your Piece</h3>
              </div>
              <Select value={settings.symbol} onValueChange={(v) => setSettings(p => ({ ...p, symbol: v }))}>
                <SelectTrigger className="h-14 bg-black/60 border-cyan-500/40 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GamePieces.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Max Players */}
            <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 rounded-2xl p-6 border border-purple-500/30">
              <div className="flex items-center gap-3 mb-4">
                <FaUsers className="w-7 h-7 text-purple-400" />
                <h3 className="text-xl font-bold text-purple-300">Max Players</h3>
              </div>
              <Select value={settings.maxPlayers.toString()} onValueChange={(v) => setSettings(p => ({ ...p, maxPlayers: +v }))}>
                <SelectTrigger className="h-14 bg-black/60 border-purple-500/40 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2,3,4,5,6,7,8].map(n => (
                    <SelectItem key={n} value={n.toString()}>{n} Players</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Private Room */}
            <div className="bg-black/60 rounded-2xl p-6 border border-gray-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MdPrivateConnectivity className="w-7 h-7 text-emerald-400" />
                  <div>
                    <h3 className="text-xl font-bold text-white">Private Room</h3>
                    <p className="text-gray-400 text-sm">Join via code only</p>
                  </div>
                </div>
                <Switch
                  checked={settings.privateRoom}
                  onCheckedChange={(v) => setSettings(p => ({ ...p, privateRoom: v }))}
                />
              </div>
            </div>

            {/* Free Game Toggle - hidden for guests (guest games are free only) */}
            {!isGuest && (
            <div className="bg-black/60 rounded-2xl p-6 border border-yellow-600/50 mt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FaCoins className="w-7 h-7 text-yellow-400" />
                  <div>
                    <h3 className="text-xl font-bold text-yellow-300">Free Game</h3>
                    <p className="text-gray-400 text-sm">Play for fun — 0 USDC</p>
                  </div>
                </div>
                <Switch
                  checked={isFreeGame}
                  onCheckedChange={(checked) => {
                    setIsFreeGame(checked);
                    if (checked) {
                      setSettings(prev => ({ ...prev, stake: 0 }));
                      setCustomStake("0");
                    }
                  }}
                />
              </div>
            </div>
            )}
            {isGuest && (
              <div className="bg-black/60 rounded-2xl p-6 border border-yellow-600/50 mt-4">
                <div className="flex items-center gap-3">
                  <FaCoins className="w-7 h-7 text-yellow-400" />
                  <div>
                    <h3 className="text-xl font-bold text-yellow-300">Guest games are free</h3>
                    <p className="text-gray-400 text-sm">Connect a wallet to create staked games</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Column 2 - Stake (hidden for guests) */}
          {!isGuest && (
          <div className={`bg-gradient-to-b from-green-900/60 to-emerald-900/60 rounded-2xl p-8 border border-green-500/40 shadow-xl transition-opacity duration-300 ${isFreeGame ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-3 mb-6">
              <FaCoins className="w-8 h-8 text-green-400" />
              <h3 className="text-2xl font-bold text-green-300">Entry Stake</h3>
            </div>

            {isFreeGame ? (
              <div className="h-64 flex items-center justify-center text-center">
                <div>
                  <p className="text-4xl font-black text-yellow-400 mb-4">FREE</p>
                  <p className="text-lg text-yellow-300/90">No entry fee required</p>
                  <p className="text-sm text-gray-400 mt-3">Pure fun • No crypto at risk</p>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {stakePresets.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => handleStakeSelect(amount)}
                      className={`py-4 rounded-xl font-bold transition-all hover:scale-105 ${
                        settings.stake === amount
                          ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-black shadow-lg"
                          : "bg-black/60 border border-gray-600 text-gray-300"
                      }`}
                    >
                      {amount} USDC
                    </button>
                  ))}
                </div>

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Custom ≥ 0.01 USDC"
                  value={customStake}
                  onChange={(e) => handleCustomStake(e.target.value)}
                  className="w-full px-4 py-4 bg-black/60 border border-green-500/50 rounded-xl text-white text-center text-lg focus:outline-none focus:border-green-400 disabled:opacity-50"
                  disabled={isFreeGame}
                />

                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-400">Current Stake</p>
                  <p className="text-3xl font-bold text-green-400">
                    {settings.stake} USDC
                  </p>
                </div>
              </>
            )}
          </div>
          )}

          {/* Column 3 */}
          <div className="space-y-6">
            {/* Starting Cash */}
            <div className="bg-gradient-to-br from-amber-900/40 to-orange-900/40 rounded-2xl p-6 border border-amber-500/30">
              <div className="flex items-center gap-3 mb-4">
                <FaCoins className="w-7 h-7 text-amber-400" />
                <h3 className="text-xl font-bold text-amber-300">Starting Cash</h3>
              </div>
              <Select value={settings.startingCash.toString()} onValueChange={(v) => setSettings(p => ({ ...p, startingCash: +v }))}>
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
            </div>

            {/* Game Duration */}
            <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 rounded-2xl p-6 border border-indigo-500/30">
              <div className="flex items-center gap-3 mb-4">
                <FaBrain className="w-7 h-7 text-indigo-400" />
                <h3 className="text-xl font-bold text-indigo-300">Game Duration</h3>
              </div>
              <Select value={settings.duration.toString()} onValueChange={(v) => setSettings(p => ({ ...p, duration: +v }))}>
                <SelectTrigger className="h-14 bg-black/60 border-indigo-500/40 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 minutes</SelectItem>
                  <SelectItem value="10">10 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">60 minutes</SelectItem>
                  <SelectItem value="90">90 minutes</SelectItem>
                  <SelectItem value="0">No limit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* House Rules */}
            <div className="bg-black/60 rounded-2xl p-6 border border-cyan-500/30">
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
                      onCheckedChange={(v) => setSettings(p => ({ ...p, [item.key]: v }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Create Button */}
        <div className="flex justify-center mt-12">
          <button
            onClick={handlePlay}
            disabled={!canCreate || (!isGuest && (isCreatePending || ((approvePending || approveConfirming) && !isFreeGame)))}
            className="relative px-24 py-6 text-3xl font-orbitron font-black tracking-widest
                       bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-600
                       hover:from-pink-600 hover:via-purple-600 hover:to-cyan-500
                       rounded-2xl shadow-2xl transform hover:scale-105 active:scale-100
                       transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed
                       border-4 border-white/20"
          >
            <span className="relative z-10 text-white drop-shadow-2xl">
              {approvePending || approveConfirming
                ? "APPROVING..."
                : isCreatePending
                ? "CREATING..."
                : isFreeGame
                ? "CREATE FREE GAME"
                : "CREATE GAME"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}