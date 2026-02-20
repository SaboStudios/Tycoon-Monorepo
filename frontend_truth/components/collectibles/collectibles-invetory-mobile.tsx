'use client';

import React, { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useChainId,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
  useBalance,
} from "wagmi";
import { formatUnits, type Address, type Abi, erc20Abi } from "viem";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import Image from "next/image";

import {
  Zap,
  Crown,
  Coins,
  Sparkles,
  Gem,
  Shield,
  ShoppingBag,
  Loader2,
  X,
  Wallet,
  Clock,
  Flame,
} from "lucide-react";

import RewardABI from "@/context/abi/rewardabi.json";
import { REWARD_CONTRACT_ADDRESSES, TYC_TOKEN_ADDRESS, USDC_TOKEN_ADDRESS } from "@/constants/contracts";
import { Game, GameProperty } from "@/types/game";
import { useRewardBurnCollectible } from "@/context/ContractProvider";
import { apiClient } from "@/lib/api";
import { ApiResponse } from "@/types/api";

const COLLECTIBLE_ID_START = 2_000_000_000;

const BOARD_POSITIONS = [
  "GO", "Axone Avenue", "Community Chest", "Onlydust Avenue", "Income Tax",
  "IPFS Railroad", "ZK-Sync Lane", "Chance", "Starknet Lane", "Linea Lane",
  "Jail / Just Visiting", "Arbitrum Avenue", "Chainlink Electric Company", "Optimistic Avenue", "Base Avenue",
  "Pinata Railroad", "Near Lane", "Community Chest", "Cosmos Lane", "Polkadot Lane",
  "Free Parking", "Dune Lane", "Chance", "Uniswap Avenue", "MakerDAO Avenue",
  "O. Zeppelin Railroad", "AAVE Avenue", "Lisk Lane", "Graphic Water Works", "Rootstock Lane",
  "Go To Jail", "The Buidl Hub", "Ark Lane", "Community Chest", "Avalanche Avenue",
  "Cartridge Railroad", "Chance", "Solana Avenue", "Luxury Tax", "Ethereum Avenue"
];

const CASH_TIERS = [0, 100, 250, 500, 700, 1000];
const REFUND_TIERS = [0, 60, 150, 300, 420, 600];
const DISCOUNT_TIERS = [0, 100, 200, 300, 400, 500];

const perkMetadata: Record<number, {
  name: string;
  icon: React.ReactNode;
  gradient: string;
  image?: string;
  canBeActivated: boolean;
  fakeDescription?: string;
}> = {
  1: { name: "Extra Turn", icon: <Zap className="w-10 h-10" />, gradient: "from-yellow-500 to-amber-600", image: "/game/shop/a.jpeg", canBeActivated: true },
  2: { name: "Jail Free Card", icon: <Crown className="w-10 h-10" />, gradient: "from-purple-600 to-pink-600", image: "/game/shop/b.jpeg", canBeActivated: true },
  3: { name: "Double Rent", icon: <Coins className="w-10 h-10" />, gradient: "from-green-600 to-emerald-600", image: "/game/shop/c.jpeg", canBeActivated: false, fakeDescription: "Not Available Yet" },
  4: { name: "Roll Boost", icon: <Sparkles className="w-10 h-10" />, gradient: "from-blue-600 to-cyan-600", image: "/game/shop/a.jpeg", canBeActivated: false, fakeDescription: "Coming Soon" },
  5: { name: "Instant Cash", icon: <Gem className="w-10 h-10" />, gradient: "from-cyan-600 to-teal-600", image: "/game/shop/b.jpeg", canBeActivated: true },
  6: { name: "Teleport", icon: <Zap className="w-10 h-10" />, gradient: "from-pink-600 to-rose-600", image: "/game/shop/c.jpeg", canBeActivated: true },
  7: { name: "Shield", icon: <Shield className="w-10 h-10" />, gradient: "from-indigo-600 to-blue-600", image: "/game/shop/a.jpeg", canBeActivated: false, fakeDescription: "Coming Soon" },
  8: { name: "Property Discount", icon: <Coins className="w-10 h-10" />, gradient: "from-orange-600 to-red-600", image: "/game/shop/b.jpeg", canBeActivated: true },
  9: { name: "Tax Refund", icon: <Gem className="w-10 h-10" />, gradient: "from-teal-600 to-cyan-600", image: "/game/shop/c.jpeg", canBeActivated: true },
  10: { name: "Exact Roll", icon: <Sparkles className="w-10 h-10" />, gradient: "from-amber-600 to-yellow-500", image: "/game/shop/a.jpeg", canBeActivated: true },
};

interface CollectibleInventoryBarProps {
  game: Game;
  game_properties: GameProperty[];
  isMyTurn: boolean;
  ROLL_DICE: () => void;
  END_TURN?: () => void;
  triggerSpecialLanding?: (position: number, isSpecial: boolean) => void;
  endTurnAfterSpecial?: () => void;
}

export default function CollectibleInventoryBar({
  game,
  game_properties,
  isMyTurn,
  ROLL_DICE,
  triggerSpecialLanding,
}: CollectibleInventoryBarProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId as keyof typeof REWARD_CONTRACT_ADDRESSES] as Address | undefined;

  const tycToken = TYC_TOKEN_ADDRESS[chainId as keyof typeof TYC_TOKEN_ADDRESS] as Address | undefined;
  const usdcToken = USDC_TOKEN_ADDRESS[chainId as keyof typeof USDC_TOKEN_ADDRESS] as Address | undefined;

  const [showMiniShop, setShowMiniShop] = useState(false);
  const [useUsdc, setUseUsdc] = useState(true);
  const [buyingId, setBuyingId] = useState<bigint | null>(null);
  const [approvingId, setApprovingId] = useState<bigint | null>(null);

  const [pendingPerk, setPendingPerk] = useState<{
    tokenId: bigint;
    perkId: number;
    name: string;
    strength?: number;
  } | null>(null);

  const [selectedPositionIndex, setSelectedPositionIndex] = useState<number | null>(null);
  const [selectedRollTotal, setSelectedRollTotal] = useState<number | null>(null);

  const selectedToken = useUsdc ? usdcToken : tycToken;
  const selectedDecimals = useUsdc ? 6 : 18;

  const { writeContract: writeBuy, data: buyHash, isPending: buyingPending } = useWriteContract();
  const { writeContract: writeApprove, data: approveHash, isPending: approving } = useWriteContract();

  const { isLoading: confirmingBuy } = useWaitForTransactionReceipt({ hash: buyHash });
  const { isLoading: confirmingApprove, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash });

  const { data: tycBal } = useBalance({ address, token: tycToken });
  const { data: usdcBal } = useBalance({ address, token: usdcToken });

  const { data: allowance } = useReadContract({
    address: selectedToken,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && contractAddress ? [address, contractAddress] : undefined,
    query: { enabled: !!address && !!contractAddress && !!selectedToken },
  });

  const currentAllowance = allowance ?? 0;

  const { burn: burnCollectible, isPending: isBurning, isSuccess: burnSuccess } = useRewardBurnCollectible();

  const currentPlayer = useMemo(() => {
    if (!address || !game?.players) return null;
    return game.players.find(p => p.address?.toLowerCase() === address.toLowerCase()) || null;
  }, [address, game?.players]);

  const getRealPlayerId = (walletAddress: string | undefined): number | null => {
    if (!walletAddress) return null;
    const owned = game_properties.find(gp => gp.address?.toLowerCase() === walletAddress.toLowerCase());
    return owned?.player_id ?? null;
  };

  const applyCashAdjustment = async (playerId: number, amount: number): Promise<boolean> => {
    if (amount === 0) return true;
    const targetPlayer = game.players.find(p => p.user_id === playerId);
    if (!targetPlayer?.address) return false;
    const realPlayerId = getRealPlayerId(targetPlayer.address);
    if (!realPlayerId) {
      toast.error("Must own a property");
      return false;
    }
    try {
      const res = await apiClient.put<ApiResponse>(`/game-players/${realPlayerId}`, {
        game_id: game.id,
        user_id: targetPlayer.user_id,
        balance: (targetPlayer.balance ?? 0) + amount,
      });
      return res?.success ?? false;
    } catch {
      toast.error("Cash adjustment failed");
      return false;
    }
  };

  const applyPositionChange = async (playerId: number, newPos: number): Promise<boolean> => {
    if (newPos < 0 || newPos > 39) return false;
    const targetPlayer = game.players.find(p => p.user_id === playerId);
    if (!targetPlayer?.address) return false;
    const realPlayerId = getRealPlayerId(targetPlayer.address);
    if (!realPlayerId) return false;
    try {
      const res = await apiClient.put<ApiResponse>(`/game-players/${realPlayerId}`, {
        game_id: game.id,
        user_id: playerId,
        position: newPos,
      });
      return res?.success ?? false;
    } catch {
      toast.error("Position change failed");
      return false;
    }
  };

  const escapeJail = async (playerId: number): Promise<boolean> => {
    const targetPlayer = game.players.find(p => p.user_id === playerId);
    if (!targetPlayer?.address) return false;
    const realPlayerId = getRealPlayerId(targetPlayer.address);
    if (!realPlayerId) return false;
    try {
      const res = await apiClient.put<ApiResponse>(`/game-players/${realPlayerId}`, {
        game_id: game.id,
        user_id: playerId,
        in_jail: false,
      });
      return res?.success ?? false;
    } catch {
      toast.error("Failed to escape jail");
      return false;
    }
  };

  // === OWNED COLLECTIBLES ===
  const { data: ownedCountRaw } = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: "ownedTokenCount",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!contractAddress },
  });

  const ownedCount = Number(ownedCountRaw ?? 0);

  const tokenCalls = useMemo(() => 
    Array.from({ length: ownedCount }, (_, i) => ({
      address: contractAddress!,
      abi: RewardABI as Abi,
      functionName: "tokenOfOwnerByIndex" as const,
      args: [address!, BigInt(i)],
    })),
    [contractAddress, address, ownedCount]
  );

  const { data: tokenResults } = useReadContracts({
    contracts: tokenCalls,
    query: { enabled: ownedCount > 0 && !!contractAddress && !!address },
  });

  const ownedTokenIds = tokenResults
    ?.map(r => r.status === "success" ? r.result as bigint : null)
    .filter((id): id is bigint => id !== null && id >= BigInt(COLLECTIBLE_ID_START)) ?? [];

  const infoCalls = useMemo(() => 
    ownedTokenIds.map(id => ({
      address: contractAddress!,
      abi: RewardABI as Abi,
      functionName: "getCollectibleInfo" as const,
      args: [id],
    })),
    [contractAddress, ownedTokenIds]
  );

  const { data: infoResults } = useReadContracts({
    contracts: infoCalls,
    query: { enabled: ownedTokenIds.length > 0 },
  });

  const ownedCollectibles = useMemo(() => {
    if (!infoResults) return [];

    return infoResults
      .map((res, i) => {
        if (res?.status !== "success") return null;
        const [perkBig, strengthBig] = res.result as [bigint, bigint];
        const perk = Number(perkBig);
        const strength = Number(strengthBig);
        const meta = perkMetadata[perk] ?? perkMetadata[10];

        const displayName = (perk === 5 || perk === 8 || perk === 9)
          ? `${meta.name} (Tier ${strength})`
          : meta.name;

        return {
          tokenId: ownedTokenIds[i],
          perk,
          name: displayName,
          icon: meta.icon,
          gradient: meta.gradient,
          canBeActivated: meta.canBeActivated,
          fakeDescription: meta.fakeDescription,
          strength,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
  }, [infoResults, ownedTokenIds]);

  const totalOwned = ownedCollectibles.length;

  // === SHOP ITEMS ===
  const { data: shopCountRaw } = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: "ownedTokenCount",
    args: contractAddress ? [contractAddress] : undefined,
    query: { enabled: !!contractAddress },
  });

  const shopCount = Number(shopCountRaw ?? 0);

  const shopTokenCalls = useMemo(() => 
    Array.from({ length: shopCount }, (_, i) => ({
      address: contractAddress!,
      abi: RewardABI as Abi,
      functionName: "tokenOfOwnerByIndex" as const,
      args: [contractAddress!, BigInt(i)],
    })),
    [contractAddress, shopCount]
  );

  const { data: shopTokenResults } = useReadContracts({
    contracts: shopTokenCalls,
    query: { enabled: shopCount > 0 && !!contractAddress },
  });

  const shopTokenIds = shopTokenResults
    ?.map(r => r.status === "success" ? r.result as bigint : null)
    .filter((id): id is bigint => id !== null && id >= BigInt(COLLECTIBLE_ID_START)) ?? [];

  const shopInfoCalls = useMemo(() => 
    shopTokenIds.map(id => ({
      address: contractAddress!,
      abi: RewardABI as Abi,
      functionName: "getCollectibleInfo" as const,
      args: [id],
    })),
    [contractAddress, shopTokenIds]
  );

  const { data: shopInfoResults } = useReadContracts({
    contracts: shopInfoCalls,
    query: { enabled: shopTokenIds.length > 0 },
  });

  const shopItems = useMemo(() => {
    if (!shopInfoResults) return [];

    return shopInfoResults
      .map((res, i) => {
        if (res?.status !== "success") return null;
        const [perkBig, , tycPriceBig, usdcPriceBig, stockBig] = res.result as [bigint, bigint, bigint, bigint, bigint];
        const perk = Number(perkBig);
        const stock = Number(stockBig);
        if (stock === 0) return null;

        const meta = perkMetadata[perk] ?? perkMetadata[10];

        return {
          tokenId: shopTokenIds[i],
          perk,
          tycPrice: formatUnits(tycPriceBig, 18),
          usdcPrice: formatUnits(usdcPriceBig, 6),
          stock,
          name: meta.name,
          icon: meta.icon,
          gradient: meta.gradient,
          image: meta.image,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [shopInfoResults, shopTokenIds]);

  // === BUY LOGIC ===
  const handleBuy = async (item: typeof shopItems[number]) => {
    if (!contractAddress || !address) {
      toast.error("Wallet not connected");
      return;
    }

    const priceStr = useUsdc ? item.usdcPrice : item.tycPrice;
    const priceBig = BigInt(Math.round(parseFloat(priceStr) * 10 ** selectedDecimals));

    if (currentAllowance < priceBig) {
      setApprovingId(item.tokenId);
      toast.loading(`Approving ${useUsdc ? "USDC" : "TYC"}...`, { id: "approve" });
      writeApprove({
        address: selectedToken!,
        abi: erc20Abi,
        functionName: "approve",
        args: [contractAddress, priceBig],
      });
      return;
    }

    setBuyingId(item.tokenId);
    toast.loading("Purchasing...", { id: "buy" });
    writeBuy({
      address: contractAddress,
      abi: RewardABI,
      functionName: "buyCollectible",
      args: [item.tokenId, useUsdc],
    });
  };

  useEffect(() => {
    if (approveSuccess && approvingId !== null) {
      toast.dismiss("approve");
      toast.success("Approved! Completing purchase...");
      const item = shopItems.find(i => i.tokenId === approvingId);
      if (item) handleBuy(item);
      setApprovingId(null);
    }
  }, [approveSuccess, approvingId, shopItems, handleBuy]);

  useEffect(() => {
    if (buyHash && !buyingPending && !confirmingBuy) {
      toast.success("Purchase complete! 🎉");
      setBuyingId(null);
    }
  }, [buyHash, buyingPending, confirmingBuy]);

  // === PERK ACTIVATION ===
  const handleUsePerk = (
    tokenId: bigint,
    perkId: number,
    name: string,
    canBeActivated: boolean,
    strength: number = 1
  ) => {
    if (!isMyTurn) {
      toast("Wait for your turn!", { icon: "⏳" });
      return;
    }

    if (!currentPlayer) {
      toast.error("Player data not found");
      return;
    }

    if (!canBeActivated) {
      toast(`${name} — ${perkMetadata[perkId]?.fakeDescription || "Coming Soon"}`, {
        icon: <Clock className="w-5 h-5" />,
        duration: 5000
      });
      return;
    }

    setPendingPerk({ tokenId, perkId, name, strength });
  };

  useEffect(() => {
    if (!pendingPerk || !burnSuccess || !currentPlayer) return;

    const { perkId, name, strength = 1 } = pendingPerk;

    const toastId = toast.loading("Applying perk effect...");

    (async () => {
      try {
        let success = false;

        switch (perkId) {
          case 1: // Extra Turn
            toast.success("Extra Turn activated! Roll again!", { id: toastId });
            setTimeout(() => ROLL_DICE(), 800);
            success = true;
            break;
          case 2: // Jail Free Card
            success = await escapeJail(currentPlayer.user_id);
            if (success) toast.success("Escaped jail! 🚔➡️🛤️", { id: toastId });
            break;
          case 5: // Instant Cash
            const amount = CASH_TIERS[Math.min(strength, CASH_TIERS.length - 1)];
            success = await applyCashAdjustment(currentPlayer.user_id, amount);
            if (success) toast.success(`+$${amount} Instant Cash!`, { id: toastId });
            break;
          case 8: // Property Discount
            const discount = DISCOUNT_TIERS[Math.min(strength, DISCOUNT_TIERS.length - 1)];
            success = await applyCashAdjustment(currentPlayer.user_id, discount);
            if (success && discount > 0) toast.success(`+$${discount} Property Discount!`, { id: toastId });
            break;
          case 9: // Tax Refund
            const refund = REFUND_TIERS[Math.min(strength, REFUND_TIERS.length - 1)];
            success = await applyCashAdjustment(currentPlayer.user_id, refund);
            if (success) toast.success(`+$${refund} Tax Refund!`, { id: toastId });
            break;
          case 6: // Teleport
          case 10: // Exact Roll
            if (triggerSpecialLanding && selectedPositionIndex !== null) {
              const targetPos = perkId === 6
                ? selectedPositionIndex
                : (currentPlayer.position + (selectedRollTotal ?? 0)) % 40;

              const posSuccess = await applyPositionChange(currentPlayer.user_id, targetPos);
              if (posSuccess) {
                triggerSpecialLanding(targetPos, true);
                toast.success(`${name} activated! Moved!`, { id: toastId });
                success = true;
              }
            }
            break;
        }

        if (success || perkId === 1) {
          toast.success(`${name} activated & collectible burned! 🔥`, { id: toastId });
        } else {
          toast.error("Effect failed — contact support", { id: toastId });
        }
      } catch (err) {
        toast.error("Activation failed", { id: toastId });
      } finally {
        setPendingPerk(null);
        setSelectedPositionIndex(null);
        setSelectedRollTotal(null);
      }
    })();
  }, [
    burnSuccess,
    pendingPerk,
    currentPlayer,
    ROLL_DICE,
    triggerSpecialLanding,
    selectedPositionIndex,
    selectedRollTotal
  ]);

  const handleConfirmBurnAndActivate = async () => {
    if (!pendingPerk) return;

    const toastId = toast.loading("Burning collectible... 🔥");

    try {
      await burnCollectible(pendingPerk.tokenId);
    } catch (err) {
      toast.error("Burn failed — perk not activated", { id: toastId });
      setPendingPerk(null);
      setSelectedPositionIndex(null);
      setSelectedRollTotal(null);
    }
  };

  if (!isConnected) return null;

  return (
    <>
      {/* PERKS LIST - Improved with better spacing and card styles for friendliness */}
      <div className="space-y-6 pb-40 md:pb-32 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h3 className="text-2xl md:text-3xl font-bold text-cyan-300">
            Your Perks ({totalOwned})
          </h3>

          <button
            onClick={() => setShowMiniShop(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-cyan-500 rounded-full text-white font-semibold shadow-lg hover:shadow-cyan-500/50 transition active:scale-95"
          >
            <ShoppingBag className="w-5 h-5" />
            Open Shop
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {ownedCollectibles.map((item) => (
            <motion.button
              key={item.tokenId.toString()}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleUsePerk(item.tokenId, item.perk, item.name, item.canBeActivated, item.strength)}
              disabled={!isMyTurn || !item.canBeActivated}
              className={`relative overflow-hidden rounded-2xl p-5 text-left transition-all shadow-md
                bg-gradient-to-br ${item.gradient} opacity-90
                ${!isMyTurn || !item.canBeActivated
                  ? "opacity-60 cursor-not-allowed"
                  : "hover:shadow-xl hover:shadow-cyan-500/40 hover:opacity-100 active:scale-98"}
              `}
            >
              <div className="flex items-center gap-4">
                <div className="text-white shrink-0">
                  {React.cloneElement(item.icon as React.ReactElement, { className: "w-12 h-12" })}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-lg md:text-xl leading-tight">{item.name}</p>
                  {!item.canBeActivated && (
                    <p className="text-sm text-gray-100 mt-1">
                      {item.fakeDescription || "Coming Soon"}
                    </p>
                  )}
                </div>

                {!isMyTurn && (
                  <div className="text-sm text-gray-100 whitespace-nowrap">Wait for Turn</div>
                )}
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* MINI SHOP BOTTOM SHEET - Made more mobile-friendly with rounded corners, smoother animations, grid layout option, and better touch handling */}
      <AnimatePresence>
        {showMiniShop && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMiniShop(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
            />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 280 }}
              className="
                fixed inset-x-0 bottom-0
                z-[9999]
                max-h-[85vh] sm:max-h-[90vh]
                bg-gradient-to-b from-[#0A1418] to-[#061015]
                rounded-t-3xl
                border-t border-cyan-600/30
                flex flex-col
                shadow-2xl shadow-black/50
                overflow-hidden
              "
            >
              <div className="sticky top-0 z-10 bg-[#0A1418]/95 backdrop-blur-md border-b border-cyan-900/30 px-5 py-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-3 text-cyan-300">
                  <ShoppingBag className="w-6 h-6" />
                  Perk Shop
                </h2>
                <button onClick={() => setShowMiniShop(false)} className="p-2 rounded-full hover:bg-white/5 transition">
                  <X className="w-6 h-6 text-gray-300" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                <div className="flex justify-around gap-4 text-base">
                  <div className="flex items-center gap-2 bg-gray-800/50 px-4 py-2 rounded-full">
                    <Wallet className="w-5 h-5 text-cyan-400" />
                    <span className="text-white">TYC: {tycBal ? Number(tycBal.formatted).toFixed(2) : "0.00"}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-800/50 px-4 py-2 rounded-full">
                    <Wallet className="w-5 h-5 text-cyan-400" />
                    <span className="text-white">USDC: {usdcBal ? Number(usdcBal.formatted).toFixed(2) : "0.00"}</span>
                  </div>
                </div>

                {/* <button
                  onClick={() => setUseUsdc(!useUsdc)}
                  className="w-full py-4 bg-cyan-950/50 rounded-2xl border border-cyan-700/40 text-lg font-medium hover:bg-cyan-900/50 transition text-white"
                >
                  Pay with {useUsdc ? "TYC" : "USDC"}
                </button> */}
              </div>

              <div className="flex-1 overflow-y-auto px-5 pb-8">
                {shopItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-400 text-lg">
                    <ShoppingBag className="w-16 h-16 mb-4 opacity-50" />
                    No items in stock right now...
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {shopItems.map((item) => (
                      <motion.div
                        key={item.tokenId.toString()}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="bg-gradient-to-br from-[#0F1A1F] to-[#0A1418] rounded-2xl border border-cyan-900/30 overflow-hidden shadow-lg hover:shadow-cyan-500/20 transition-shadow"
                      >
                        <div className="relative h-48">
                          <Image
                            src={item.image || "/game/shop/placeholder.jpg"}
                            alt={item.name}
                            fill
                            className="object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                          <div className="absolute bottom-4 left-4 flex items-center gap-3">
                            <div className="text-white text-4xl">{item.icon}</div>
                            <div>
                              <h3 className="text-xl font-bold text-white">{item.name}</h3>
                              <p className="text-sm text-gray-300">Stock: {item.stock}</p>
                            </div>
                          </div>
                        </div>

                        <div className="p-5">
                          <p className="text-2xl font-bold text-cyan-300 mb-4">
                            {useUsdc ? `$${Number(item.usdcPrice).toFixed(2)}` : `${Number(item.tycPrice).toFixed(1)} TYC`}
                          </p>

                          <button
                            onClick={() => handleBuy(item)}
                            disabled={buyingId === item.tokenId || approvingId === item.tokenId}
                            className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-cyan-400 text-black font-bold text-lg disabled:opacity-60 flex items-center justify-center gap-3 transition active:scale-95"
                          >
                            {buyingId === item.tokenId || approvingId === item.tokenId ? (
                              <>
                                <Loader2 className="w-6 h-6 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              "Buy Now"
                            )}
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* BURN CONFIRMATION SHEET - Improved with softer colors and better mobile layout */}
      <AnimatePresence>
        {pendingPerk && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 z-[9998]"
              onClick={() => {
                setPendingPerk(null);
                setSelectedPositionIndex(null);
                setSelectedRollTotal(null);
              }}
            />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 280 }}
              className="
                fixed inset-x-0 bottom-0
                z-[100000]
                max-h-[85vh]
                bg-[#0A1418]
                rounded-t-3xl
                border-t border-red-600/40
                shadow-2xl shadow-black/50
                overflow-y-auto
              "
            >
              <div className="p-6 text-center mb-15">
                <Flame className="w-20 h-20 text-red-500 mx-auto mb-6 animate-pulse" />
                <h2 className="text-3xl font-bold text-white mb-4">Burn Collectible?</h2>
                <p className="text-2xl text-cyan-300 font-semibold mb-6">{pendingPerk.name}</p>

                <p className="text-red-300 text-lg leading-relaxed mb-8">
                  This action is <strong>permanent</strong>.<br />
                  The collectible will be <strong>burned forever</strong>.
                </p>

                {(pendingPerk.perkId === 6 || pendingPerk.perkId === 10) && (
                  <div className="mb-10">
                    <p className="text-xl text-white mb-6">
                      {pendingPerk.perkId === 6 ? "Choose destination:" : "Choose exact roll:"}
                    </p>

                    {pendingPerk.perkId === 6 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-80 overflow-y-auto">
                        {BOARD_POSITIONS.map((name, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setSelectedPositionIndex(i)}
                            className={`py-3 px-4 rounded-xl text-sm font-medium transition-colors ${
                              selectedPositionIndex === i
                                ? "bg-cyan-600 text-white shadow-md"
                                : "bg-gray-800 hover:bg-gray-700 text-gray-200"
                            }`}
                          >
                            {i}. {name}
                          </button>
                        ))}
                      </div>
                    )}

                    {pendingPerk.perkId === 10 && (
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                        {[2,3,4,5,6,7,8,9,10,11,12].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setSelectedRollTotal(n)}
                            className={`py-6 rounded-xl text-2xl font-bold transition-all ${
                              selectedRollTotal === n
                                ? "bg-cyan-600 text-white shadow-md scale-105"
                                : "bg-gray-800 hover:bg-gray-700 text-gray-200"
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 mt-8">
                  <button
                    onClick={() => {
                      setPendingPerk(null);
                      setSelectedPositionIndex(null);
                      setSelectedRollTotal(null);
                    }}
                    className="py-5 rounded-2xl bg-gray-800 hover:bg-gray-700 text-white font-bold text-lg transition"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handleConfirmBurnAndActivate}
                    disabled={
                      isBurning ||
                      (pendingPerk.perkId === 6 && selectedPositionIndex === null) ||
                      (pendingPerk.perkId === 10 && selectedRollTotal === null)
                    }
                    className="py-5 rounded-2xl bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 disabled:opacity-60 text-white font-bold text-lg flex items-center justify-center gap-3 transition shadow-md"
                  >
                    {isBurning ? (
                      <>
                        <Loader2 className="w-7 h-7 animate-spin" />
                        Burning...
                      </>
                    ) : (
                      <>
                        <Flame className="w-7 h-7" />
                        Burn & Use
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}