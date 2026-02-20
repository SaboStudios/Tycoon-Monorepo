'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  useAccount,
  useChainId,
  useBalance,
  useReadContract,
  useReadContracts,
} from 'wagmi';
import { formatUnits, type Address, type Abi } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ShoppingBag,
  Coins,
  Loader2,
  CreditCard,
  Zap,
  Shield,
  Sparkles,
  Gem,
  Crown,
  Ticket,
  Wallet,
  RefreshCw,
  X,
  ArrowLeft,
} from 'lucide-react';

import RewardABI from '@/context/abi/rewardabi.json';
import Erc20Abi from '@/context/abi/ERC20abi.json';
import {
  REWARD_CONTRACT_ADDRESSES,
  USDC_TOKEN_ADDRESS,
} from '@/constants/contracts';

import {
  useRewardBuyCollectible,
  useRewardRedeemVoucher,
  useApprove,
} from '@/context/ContractProvider';

const VOUCHER_ID_START = 1_000_000_000;
const COLLECTIBLE_ID_START = 2_000_000_000;

const isVoucherToken = (tokenId: bigint) =>
  tokenId >= VOUCHER_ID_START && tokenId < COLLECTIBLE_ID_START;

const isCollectibleToken = (tokenId: bigint) => tokenId >= COLLECTIBLE_ID_START;

const perkMetadata = [
  { perk: 1, name: "Extra Turn", desc: "Get +1 extra turn!", icon: <Zap />, image: "/game/shop/a.jpeg" },
  { perk: 2, name: "Jail Free Card", desc: "Escape jail instantly!", icon: <Crown />, image: "/game/shop/b.jpeg" },
  { perk: 3, name: "Double Rent", desc: "Next rent doubled!", icon: <Coins />, image: "/game/shop/c.jpeg" },
  { perk: 4, name: "Roll Boost", desc: "Bonus to next roll!", icon: <Sparkles />, image: "/game/shop/a.jpeg" },
  { perk: 5, name: "Instant Cash", desc: "Burn for tiered TYC!", icon: <Gem />, image: "/game/shop/b.jpeg" },
  { perk: 6, name: "Teleport", desc: "Move to any property!", icon: <Zap />, image: "/game/shop/c.jpeg" },
  { perk: 7, name: "Shield", desc: "Protect from rent/fees!", icon: <Shield />, image: "/game/shop/a.jpeg" },
  { perk: 8, name: "Property Discount", desc: "30-50% off next buy!", icon: <Coins />, image: "/game/shop/b.jpeg" },
  { perk: 9, name: "Tax Refund", desc: "Tiered tax cash back!", icon: <Gem />, image: "/game/shop/c.jpeg" },
  { perk: 10, name: "Exact Roll", desc: "Choose exact roll 2-12!", icon: <Sparkles />, image: "/game/shop/a.jpeg" },
];

export default function GameShopMobile() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId as keyof typeof REWARD_CONTRACT_ADDRESSES] as Address | undefined;
  const usdcTokenAddress = USDC_TOKEN_ADDRESS[chainId as keyof typeof USDC_TOKEN_ADDRESS] as Address | undefined;

  const [isVoucherPanelOpen, setIsVoucherPanelOpen] = useState(false);

  // Prevent body scroll when voucher panel is open
  useEffect(() => {
    if (isVoucherPanelOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isVoucherPanelOpen]);

  // USDC Allowance
  const { data: usdcAllowance } = useReadContract({
    address: usdcTokenAddress,
    abi: Erc20Abi,
    functionName: 'allowance',
    args: address && contractAddress ? [address, contractAddress] : undefined,
    query: { enabled: !!address && !!usdcTokenAddress && !!contractAddress },
  });

  // Buy / Approve / Redeem hooks
  const { buy, isPending: buyingPending, isConfirming: buyingConfirming, isSuccess: buySuccess, error: buyError, reset: resetBuy } = useRewardBuyCollectible();
  const { approve, isPending: approvePending, isSuccess: approveSuccess, error: approveError, reset: resetApprove } = useApprove();
  const { redeem, isPending: redeemingPending, isConfirming: redeemingConfirming, isSuccess: redeemSuccess, error: redeemError, reset: resetRedeem } = useRewardRedeemVoucher();

  // USDC Balance
  const { data: usdcBalanceData, isLoading: usdcLoading, refetch: refetchUsdc } = useBalance({
    address,
    token: usdcTokenAddress,
    query: { enabled: !!address && !!usdcTokenAddress && isConnected },
  });

  const usdcBalance = usdcBalanceData ? Number(usdcBalanceData.formatted).toFixed(2) : '0.00';

  // Shop Items: Collectibles owned by contract (in shop stock)
  const { data: contractOwnedCount } = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: 'ownedTokenCount',
    args: contractAddress ? [contractAddress] : undefined,
    query: { enabled: !!contractAddress },
  });

  const contractTokenCount = Number(contractOwnedCount ?? 0);

  const contractTokenIdCalls = useMemo(
    () =>
      Array.from({ length: contractTokenCount }, (_, i) => ({
        address: contractAddress!,
        abi: RewardABI as Abi,
        functionName: 'tokenOfOwnerByIndex' as const,
        args: [contractAddress!, BigInt(i)] as const,
      })),
    [contractAddress, contractTokenCount]
  );

  const { data: contractTokenIdResults } = useReadContracts({
    contracts: contractTokenIdCalls,
    query: { enabled: contractTokenCount > 0 && !!contractAddress },
  });

  const shopTokenIds = useMemo(() => {
    return (
      contractTokenIdResults
        ?.map((res) => (res.status === 'success' ? (res.result as bigint) : undefined))
        .filter((id): id is bigint => id !== undefined && isCollectibleToken(id)) ?? []
    );
  }, [contractTokenIdResults]);

  const shopInfoCalls = useMemo(
    () =>
      shopTokenIds.map((tokenId) => ({
        address: contractAddress!,
        abi: RewardABI as Abi,
        functionName: 'getCollectibleInfo' as const,
        args: [tokenId] as const,
      })),
    [contractAddress, shopTokenIds]
  );

  const { data: shopInfoResults } = useReadContracts({
    contracts: shopInfoCalls,
    query: { enabled: shopTokenIds.length > 0 && !!contractAddress },
  });

  const shopItems = useMemo(() => {
    if (!shopInfoResults) return [];

    return shopInfoResults
      .map((result, index) => {
        if (result.status !== 'success') return null;
        const [perk, strength, tycPrice, usdcPrice, stock] = result.result as [number, bigint, bigint, bigint, bigint];
        if (stock === BigInt(0)) return null;

        const tokenId = shopTokenIds[index];
        const meta = perkMetadata.find((m) => m.perk === perk) || {
          name: `Perk #${perk}`,
          desc: 'Powerful game advantage',
          icon: <Gem className="w-12 h-12 text-gray-400" />,
          image: '/game/shop/placeholder.jpg',
        };

        return {
          tokenId,
          perk,
          strength: Number(strength),
          tycPrice: formatUnits(tycPrice, 18),
          usdcPrice: formatUnits(usdcPrice, 6),
          stock: Number(stock),
          ...meta,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [shopInfoResults, shopTokenIds]);

  // User Vouchers
  const { data: userOwnedCount } = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: 'ownedTokenCount',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!contractAddress },
  });

  const userTokenCount = Number(userOwnedCount ?? 0);

  const userTokenIdCalls = useMemo(
    () =>
      Array.from({ length: userTokenCount }, (_, i) => ({
        address: contractAddress!,
        abi: RewardABI as Abi,
        functionName: 'tokenOfOwnerByIndex' as const,
        args: [address!, BigInt(i)] as const,
      })),
    [contractAddress, address, userTokenCount]
  );

  const { data: userTokenIdResults } = useReadContracts({
    contracts: userTokenIdCalls,
    query: { enabled: userTokenCount > 0 && !!address && !!contractAddress },
  });

  const userVoucherIds = useMemo(() => {
    return (
      userTokenIdResults
        ?.map((res) => (res.status === 'success' ? (res.result as bigint) : undefined))
        .filter((id): id is bigint => id !== undefined && isVoucherToken(id)) ?? []
    );
  }, [userTokenIdResults]);

  const voucherInfoCalls = useMemo(
    () =>
      userVoucherIds.map((tokenId) => ({
        address: contractAddress!,
        abi: RewardABI as Abi,
        functionName: 'getCollectibleInfo' as const,
        args: [tokenId] as const,
      })),
    [contractAddress, userVoucherIds]
  );

  const { data: voucherInfoResults } = useReadContracts({
    contracts: voucherInfoCalls,
    query: { enabled: userVoucherIds.length > 0 && !!contractAddress },
  });

  const myVouchers = useMemo(() => {
    if (!voucherInfoResults) return [];

    return voucherInfoResults
      .map((result, i) => {
        if (result.status !== 'success') return null;
        const [, , tycPrice] = result.result as [number, bigint, bigint, bigint, bigint];
        const tokenId = userVoucherIds[i];
        return {
          tokenId,
          value: formatUnits(tycPrice, 18),
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);
  }, [voucherInfoResults, userVoucherIds]);

  // Handlers
  const handleBuy = async (item: typeof shopItems[0]) => {
    if (!isConnected || !address) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!usdcTokenAddress) {
      toast.error('USDC not supported on this network');
      return;
    }

    try {
      const price = BigInt(Math.round(Number(item.usdcPrice) * 1e6));

      if (usdcAllowance === undefined || usdcAllowance === null) {
        toast.info('Approval required');
        await approve(usdcTokenAddress, contractAddress!, price);
        toast.success('Approval successful');
      } else if (typeof usdcAllowance === 'bigint' && usdcAllowance < price) {
        toast.info('Increasing approval...');
        await approve(usdcTokenAddress, contractAddress!, price);
        toast.success('Approval updated');
      }

      await buy(item.tokenId, true); // true = use USDC
    } catch (err: any) {
      toast.error(err.message || 'Transaction failed');
    }
  };

  const handleRedeemVoucher = async (tokenId: bigint) => {
    if (!isConnected) {
      toast.error('Please connect your wallet');
      return;
    }

    try {
      await redeem(tokenId);
    } catch (err: any) {
      toast.error(err.message || 'Redemption failed');
    }
  };

  // Success / Error toasts
  useEffect(() => {
    if (buySuccess) {
      toast.success('Purchase successful! 🎉');
      refetchUsdc();
      resetBuy();
    }
  }, [buySuccess, refetchUsdc, resetBuy]);

  useEffect(() => {
    if (redeemSuccess) {
      toast.success('Voucher redeemed successfully!');
      resetRedeem();
    }
  }, [redeemSuccess, resetRedeem]);

  useEffect(() => {
    if (buyError) toast.error(buyError.message || 'Purchase failed');
    if (redeemError) toast.error(redeemError.message || 'Redemption failed');
  }, [buyError, redeemError]);

  const handleBack = () => router.push('/');

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#010F10] to-[#0A1415] text-white pb-24">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-[#010F10]/90 backdrop-blur-lg border-b border-[#003B3E]/60">
        <div className="flex items-center justify-between px-4 py-4 max-w-xl mx-auto">
          <button
            onClick={handleBack}
            className="p-2 -ml-2 text-[#00F0FF] hover:text-[#0FF0FC] transition"
          >
            <ArrowLeft size={28} />
          </button>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <ShoppingBag size={26} className="text-[#00F0FF]" />
            Perk Shop
          </h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="px-4 pt-6 pb-32 max-w-xl mx-auto space-y-8">
        {/* USDC Balance */}
        <div className="bg-[#0E1415]/70 rounded-2xl p-5 border border-[#003B3E]/60 text-center">
          <p className="text-sm text-gray-400 mb-1">Your USDC Balance</p>
          <p className="text-3xl font-bold text-[#00F0FF]">
            {usdcLoading ? <Loader2 className="inline animate-spin" /> : `$${usdcBalance}`}
          </p>
          <button
            onClick={() => refetchUsdc()}
            className="mt-2 text-xs text-[#00F0FF] hover:underline flex items-center gap-1.5 mx-auto"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Shop Items */}
        {!isConnected ? (
          <div className="text-center py-16 px-6 bg-[#0E1415]/50 rounded-2xl border border-red-900/40">
            <Wallet size={48} className="mx-auto mb-4 text-red-400 opacity-70" />
            <h3 className="text-xl font-bold mb-3">Wallet Required</h3>
            <p className="text-gray-400 mb-6">
              Connect your wallet to purchase game perks with USDC
            </p>
          </div>
        ) : shopItems.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <ShoppingBag size={64} className="mx-auto mb-6 opacity-40" />
            <p className="text-xl">Shop is currently empty</p>
            <p className="mt-2">New perks coming soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {shopItems.map((item) => (
              <motion.div
                key={item.tokenId.toString()}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="bg-[#0E1415]/80 rounded-2xl overflow-hidden border border-[#003B3E]/70 hover:border-[#00F0FF]/40 transition-all"
              >
                <div className="relative aspect-[4/3]">
                  <Image
                    src={item.image || '/game/shop/placeholder.jpg'}
                    alt={item.name}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="font-bold text-lg leading-tight">{item.name}</p>
                  </div>
                </div>

                <div className="p-4">
                  <p className="text-xs text-gray-400 mb-3 line-clamp-2">{item.desc}</p>

                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <p className="text-xs text-gray-400">Price</p>
                      <p className="text-lg font-bold text-[#00F0FF]">${item.usdcPrice}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Stock</p>
                      <p className="text-base font-bold">{item.stock || '0'}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleBuy(item)}
                    disabled={item.stock === 0 || buyingPending || buyingConfirming}
                    className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all
                      ${item.stock === 0 
                        ? 'bg-gray-800 text-gray-500' 
                        : buyingPending || buyingConfirming 
                        ? 'bg-amber-700 text-white' 
                        : 'bg-gradient-to-r from-[#00F0FF] to-[#0FF0FC] text-black hover:brightness-110'}`}
                  >
                    {buyingPending || buyingConfirming ? (
                      <Loader2 className="inline animate-spin mr-2" size={18} />
                    ) : item.stock === 0 ? 'Sold Out' : 'Buy Now'}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Voucher Button */}
      <AnimatePresence>
        {myVouchers.length > 0 && !isVoucherPanelOpen && (
          <motion.button
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            onClick={() => setIsVoucherPanelOpen(true)}
            className="fixed bottom-6 right-6 z-40 bg-gradient-to-br from-amber-600 to-orange-600 text-white rounded-full p-5 shadow-2xl shadow-amber-900/40 flex items-center gap-3 hover:scale-105 transition-transform"
          >
            <Ticket size={28} />
            <div className="text-left">
              <p className="text-xs opacity-90">Vouchers</p>
              <p className="font-bold text-lg">{myVouchers.length}</p>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Voucher Side Sheet */}
      <AnimatePresence>
        {isVoucherPanelOpen && (
          <>
            {/* Backdrop - always clickable */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsVoucherPanelOpen(false)}
              className="fixed inset-0 bg-black/70 z-[9999] backdrop-blur-sm"
            />

            {/* Voucher Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-gradient-to-b from-[#0A1F20] to-[#0B1718] z-[10000] overflow-y-auto border-l border-amber-700/30"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-8 sticky top-0 bg-[#0A1F20]/90 backdrop-blur-md -mx-6 -mt-6 px-6 pt-6 pb-4 z-10">
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <Ticket className="text-amber-400" size={28} />
                    My Vouchers
                  </h2>
                  <button 
                    onClick={() => setIsVoucherPanelOpen(false)} 
                    className="p-3 rounded-full hover:bg-white/10 transition"
                  >
                    <X size={32} className="text-white" />
                  </button>
                </div>

                {myVouchers.length === 0 ? (
                  <div className="text-center py-20 text-gray-400">
                    <Ticket size={64} className="mx-auto mb-6 opacity-30" />
                    <p>No vouchers available yet</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {myVouchers.map((v) => (
                      <div
                        key={v.tokenId.toString()}
                        className="bg-gradient-to-br from-amber-950/40 to-orange-950/30 rounded-2xl p-5 border border-amber-800/40"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <p className="text-2xl font-bold text-amber-300">{v.value} TYC</p>
                            <p className="text-sm text-gray-400 mt-1">Voucher ID: {v.tokenId.toString()}</p>
                          </div>
                          <Ticket className="text-amber-400" size={40} />
                        </div>

                        <button
                          onClick={() => handleRedeemVoucher(v.tokenId)}
                          disabled={redeemingPending || redeemingConfirming}
                          className={`w-full py-4 rounded-xl font-bold transition-all
                            ${redeemingPending || redeemingConfirming
                              ? 'bg-gray-800 text-gray-500'
                              : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:brightness-110 text-white'}`}
                        >
                          {redeemingPending || redeemingConfirming ? (
                            <Loader2 className="animate-spin inline mr-2" />
                          ) : 'Redeem Now'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}