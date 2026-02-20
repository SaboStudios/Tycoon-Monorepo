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
} from 'lucide-react';

import RewardABI from '@/context/abi/rewardabi.json';
import Erc20Abi from '@/context/abi/ERC20abi.json';
import {
  REWARD_CONTRACT_ADDRESSES,
  TYC_TOKEN_ADDRESS,
  USDC_TOKEN_ADDRESS,
} from '@/constants/contracts';

// Import user-facing reward hooks
import {
  useRewardBuyCollectible,
  useRewardRedeemVoucher,
  useRewardCollectibleInfo,
  useApprove,
} from '@/context/ContractProvider'; // Adjust path if needed

const VOUCHER_ID_START = 1_000_000_000;
const COLLECTIBLE_ID_START = 2_000_000_000;

const isVoucherToken = (tokenId: bigint): boolean =>
  tokenId >= VOUCHER_ID_START && tokenId < COLLECTIBLE_ID_START;

const isCollectibleToken = (tokenId: bigint): boolean =>
  tokenId >= COLLECTIBLE_ID_START;

// Perk metadata
const perkMetadata = [
  { perk: 1, name: "Extra Turn", desc: "Get +1 extra turn!", icon: <Zap className="w-12 h-12 text-yellow-400" />, image: "/game/shop/a.jpeg" },
  { perk: 2, name: "Jail Free Card", desc: "Escape jail instantly!", icon: <Crown className="w-12 h-12 text-purple-400" />, image: "/game/shop/b.jpeg" },
  { perk: 3, name: "Double Rent", desc: "Next rent doubled!", icon: <Coins className="w-12 h-12 text-green-400" />, image: "/game/shop/c.jpeg" },
  { perk: 4, name: "Roll Boost", desc: "Bonus to next roll!", icon: <Sparkles className="w-12 h-12 text-blue-400" />, image: "/game/shop/a.jpeg" },
  { perk: 5, name: "Instant Cash", desc: "Burn for tiered TYC!", icon: <Gem className="w-12 h-12 text-cyan-400" />, image: "/game/shop/b.jpeg" },
  { perk: 6, name: "Teleport", desc: "Move to any property!", icon: <Zap className="w-12 h-12 text-pink-400" />, image: "/game/shop/c.jpeg" },
  { perk: 7, name: "Shield", desc: "Protect from rent/fees!", icon: <Shield className="w-12 h-12 text-indigo-400" />, image: "/game/shop/a.jpeg" },
  { perk: 8, name: "Property Discount", desc: "30-50% off next buy!", icon: <Coins className="w-12 h-12 text-orange-400" />, image: "/game/shop/b.jpeg" },
  { perk: 9, name: "Tax Refund", desc: "Tiered tax cash back!", icon: <Gem className="w-12 h-12 text-teal-400" />, image: "/game/shop/c.jpeg" },
  { perk: 10, name: "Exact Roll", desc: "Choose exact roll 2-12!", icon: <Sparkles className="w-12 h-12 text-amber-400" />, image: "/game/shop/a.jpeg" },
];

export default function GameShop() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId as keyof typeof REWARD_CONTRACT_ADDRESSES] as Address | undefined;

  const tycTokenAddress = TYC_TOKEN_ADDRESS[chainId as keyof typeof TYC_TOKEN_ADDRESS] as Address | undefined;
  const usdcTokenAddress = USDC_TOKEN_ADDRESS[chainId as keyof typeof USDC_TOKEN_ADDRESS] as Address | undefined;

  const [useUsdc, setUseUsdc] = useState(false);
  const [isVoucherPanelOpen, setIsVoucherPanelOpen] = useState(false);

  const { data: tycAllowance } = useReadContract({
  address: tycTokenAddress,
  abi: Erc20Abi,
  functionName: 'allowance',
  args: address && contractAddress ? [address, contractAddress] : undefined,
  query: { enabled: !!address && !!tycTokenAddress && !!contractAddress },
});

const { data: usdcAllowance } = useReadContract({
  address: usdcTokenAddress,
  abi: Erc20Abi,
  functionName: 'allowance',
  args: address && contractAddress ? [address, contractAddress] : undefined,
  query: { enabled: !!address && !!usdcTokenAddress && !!contractAddress },
});


  // Buy & Redeem hooks
  const {
    buy,
    isPending: buyingPending,
    isConfirming: buyingConfirming,
    isSuccess: buySuccess,
    error: buyError,
    reset: resetBuy,
  } = useRewardBuyCollectible();

    const {
    approve,
    isPending: approvePending,
    isConfirming: approveConfirming,
    isSuccess: approveSuccess,
    error: approveError,
    reset: resetapprove,
  } = useApprove();

  const {
    redeem,
    isPending: redeemingPending,
    isConfirming: redeemingConfirming,
    isSuccess: redeemSuccess,
    error: redeemError,
    reset: resetRedeem,
  } = useRewardRedeemVoucher();

  // Balances
  const { data: tycBalanceData, isLoading: tycLoading, refetch: refetchTyc } = useBalance({
    address,
    token: tycTokenAddress,
    query: { enabled: !!address && !!tycTokenAddress && isConnected },
  });

  const { data: usdcBalanceData, isLoading: usdcLoading, refetch: refetchUsdc } = useBalance({
    address,
    token: usdcTokenAddress,
    query: { enabled: !!address && !!usdcTokenAddress && isConnected },
  });

  const tycBalance = tycBalanceData ? Number(tycBalanceData.formatted).toFixed(2) : '0.00';
  const usdcBalance = usdcBalanceData ? Number(usdcBalanceData.formatted).toFixed(2) : '0.00';

  // ── Shop Items: Collectibles owned by contract (in shop stock) ──
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

  // ── User Vouchers ──
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

  // ── Handlers ──
 const handleBuy = async (item: typeof shopItems[0]) => {
  if (!isConnected || !address) {
    toast.error('Please connect your wallet');
    return;
  }

  try {
    const isPayingWithUsdc = useUsdc;

    const price = BigInt(
      isPayingWithUsdc
        ? Math.round(Number(item.usdcPrice) * 1e6)
        : Math.round(Number(item.tycPrice) * 1e18)
    );

    const allowance = isPayingWithUsdc ? usdcAllowance : tycAllowance;
    const tokenAddress = isPayingWithUsdc ? usdcTokenAddress : tycTokenAddress;

    if (!tokenAddress) {
      toast.error('Token not supported on this network');
      return;
    }

    // ── 1️⃣ Check allowance with proper type narrowing ──
    if (allowance === undefined || allowance === null) {
      toast.info('Approval required');
      await approve(tokenAddress, contractAddress!, price);
      toast.success('Approval successful, completing purchase...');
    } else if (typeof allowance === 'bigint' && allowance < price) {
      toast.info('Increasing approval...');
      await approve(tokenAddress, contractAddress!, price);
      toast.success('Approval successful, completing purchase...');
    }
    // If allowance is sufficient, skip approval

    // ── 2️⃣ Buy collectible ──
    await buy(item.tokenId, isPayingWithUsdc);
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

  // ── Success/Error Toasts ──
  useEffect(() => {
    if (buySuccess) {
      toast.success('Purchase successful! 🎉');
      refetchTyc();
      refetchUsdc();
      resetBuy();
    }
  }, [buySuccess, refetchTyc, refetchUsdc, resetBuy]);

  useEffect(() => {
    if (redeemSuccess) {
      toast.success('Voucher redeemed successfully!');
      refetchTyc();
      resetRedeem();
    }
  }, [redeemSuccess, refetchTyc, resetRedeem]);

  useEffect(() => {
    if (buyError) toast.error(buyError.message || 'Purchase failed');
    if (redeemError) toast.error(redeemError.message || 'Redemption failed');
  }, [buyError, redeemError]);

  const handleBack = () => router.push('/');

  const hasVouchers = myVouchers.length > 0;
  const isLoadingShop = contractTokenCount > 0 && shopItems.length === 0;

  return (
    <section className="min-h-screen bg-gradient-to-b from-[#010F10] to-[#0E1415] text-[#F0F7F7] py-8 px-4">
      <div className="max-w-7xl mx-auto relative">
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-wide flex items-center gap-4">
            <ShoppingBag className="w-12 h-12 text-[#00F0FF]" />
            Tycoon Perk Shop
          </h1>
          <button onClick={handleBack} className="text-[#00F0FF] hover:text-[#0FF0FC] transition text-lg">
            ← Back to Game
          </button>
        </div>

        {/* Balances + Payment Toggle */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-[#0E1415]/80 rounded-xl p-6 border border-[#003B3E] text-center relative">
            <Wallet className="w-8 h-8 mx-auto mb-2 text-[#00F0FF]" />
            <p className="text-lg font-semibold">TYC Balance</p>
            <p className="text-2xl font-bold text-[#00F0FF]">
              {tycLoading ? <Loader2 className="w-6 h-6 animate-spin inline" /> : `${tycBalance} TYC`}
            </p>
            <button onClick={() => refetchTyc()} className="absolute top-4 right-4 text-gray-400 hover:text-[#00F0FF]">
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-[#0E1415]/80 rounded-xl p-6 border border-[#003B3E] text-center relative">
            <CreditCard className="w-8 h-8 mx-auto mb-2 text-[#00F0FF]" />
            <p className="text-lg font-semibold">USDC Balance</p>
            <p className="text-2xl font-bold text-[#00F0FF]">
              {usdcLoading ? <Loader2 className="w-6 h-6 animate-spin inline" /> : `$${usdcBalance}`}
            </p>
            <button onClick={() => refetchUsdc()} className="absolute top-4 right-4 text-gray-400 hover:text-[#00F0FF]">
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-[#003B3E]/50 rounded-xl p-6 border border-[#00F0FF]/30 flex items-center justify-center">
            <button
              onClick={() => setUseUsdc(!useUsdc)}
              className="px-8 py-4 bg-[#003B3E] rounded-xl border-2 border-[#00F0FF] flex items-center gap-4 hover:bg-[#00F0FF]/20 transition text-lg font-semibold"
            >
              Pay with <span className="text-[#00F0FF]">{useUsdc ? 'USDC 💵' : 'TYC 🪙'}</span>
            </button>
          </div>
        </div>

        {/* Shop Grid */}
        {isLoadingShop ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-[#00F0FF]" />
            <span className="ml-4 text-xl">Loading perks...</span>
          </div>
        ) : shopItems.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-xl">
            No collectibles available yet. Check back soon!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
            {shopItems.map((item) => {
              const priceStr = useUsdc ? item.usdcPrice : item.tycPrice;
              const isProcessing = buyingPending || buyingConfirming;

              return (
                <motion.div
                  key={item.tokenId.toString()}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  whileHover={{ scale: 1.05, y: -8 }}
                  className="bg-[#0E1415] rounded-2xl overflow-hidden border border-[#003B3E] hover:border-[#00F0FF] transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-[#00F0FF]/30"
                >
                  <div className="relative h-56 overflow-hidden">
                    <Image
                      src={item.image || '/game/shop/placeholder.jpg'}
                      alt={item.name}
                      fill
                      className="object-cover transition-transform duration-500 hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                    <div className="absolute bottom-4 left-4 flex items-center gap-3">
                      {item.icon}
                      <span className="font-bold text-xl">{item.name}</span>
                    </div>
                  </div>

                  <div className="p-6">
                    <p className="text-gray-300 mb-5 text-sm leading-relaxed">{item.desc}</p>

                    <div className="flex justify-between items-end mb-6">
                      <div>
                        <p className="text-sm text-gray-400">Price</p>
                        <p className="text-2xl font-bold text-[#00F0FF]">
                          {useUsdc ? `$${item.usdcPrice}` : `${item.tycPrice} TYC`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-400">Stock</p>
                        <p className="text-xl font-bold">{item.stock > 0 ? item.stock : 'Sold Out'}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleBuy(item)}
                      disabled={item.stock === 0 || isProcessing}
                      className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-3 shadow-lg transition ${
                        item.stock === 0
                          ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                          : isProcessing
                          ? 'bg-yellow-600 text-black cursor-wait'
                          : 'bg-gradient-to-r from-[#00F0FF] to-[#0FF0FC] text-black hover:shadow-[#00F0FF]/50'
                      }`}
                    >
                      {isProcessing ? (
                        <> <Loader2 className="w-6 h-6 animate-spin" /> Purchasing... </>
                      ) : item.stock === 0 ? (
                        'Sold Out'
                      ) : (
                        <> <Coins className="w-6 h-6" /> Buy Now </>
                      )}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Voucher Teaser */}
        <AnimatePresence>
          {hasVouchers && !isVoucherPanelOpen && (
            <motion.button
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              onClick={() => setIsVoucherPanelOpen(true)}
              className="fixed right-8 bottom-8 z-40 bg-gradient-to-r from-amber-500 to-orange-600 text-black font-bold py-5 px-8 rounded-2xl shadow-2xl flex items-center gap-4 hover:shadow-amber-500/50 transition-all"
            >
              <Ticket className="w-8 h-8" />
              <div className="text-left">
                <p className="text-sm">You have</p>
                <p className="text-2xl font-black">{myVouchers.length} Voucher{myVouchers.length > 1 ? 's' : ''}</p>
              </div>
              <span className="ml-2 text-lg">→</span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Voucher Panel */}
        <AnimatePresence>
          {isVoucherPanelOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsVoucherPanelOpen(false)}
                className="fixed inset-0 bg-black/60 z-40"
              />

              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed right-0 top-0 h-full w-full max-w-md bg-[#0A1F20] shadow-2xl z-50 overflow-y-auto border-l border-amber-600/50"
              >
                <div className="p-8">
                  <div className="flex justify-between items-center mb-8">
                    <h2 className="text-3xl font-bold flex items-center gap-3">
                      <Ticket className="w-10 h-10 text-amber-400" />
                      My Vouchers ({myVouchers.length})
                    </h2>
                    <button
                      onClick={() => setIsVoucherPanelOpen(false)}
                      className="text-gray-400 hover:text-white transition"
                    >
                      <X className="w-8 h-8" />
                    </button>
                  </div>

                  {myVouchers.length === 0 ? (
                    <p className="text-center text-gray-400 py-20">No vouchers found.</p>
                  ) : (
                    <div className="grid gap-6">
                      {myVouchers.map((voucher) => {
                        const isProcessing = redeemingPending || redeemingConfirming;

                        return (
                          <motion.div
                            key={voucher.tokenId.toString()}
                            whileHover={{ scale: 1.03 }}
                            className="bg-gradient-to-br from-amber-900/30 to-orange-900/30 rounded-xl p-6 border border-amber-600/50 flex flex-col items-center text-center"
                          >
                            <Ticket className="w-16 h-16 text-amber-400 mb-4" />
                            <p className="text-2xl font-bold text-amber-300">{voucher.value} TYC</p>
                            <p className="text-sm text-gray-400 mt-2 mb-6">ID: {voucher.tokenId.toString()}</p>

                            <button
                              onClick={() => handleRedeemVoucher(voucher.tokenId)}
                              disabled={isProcessing}
                              className={`w-full py-4 rounded-lg font-bold flex items-center justify-center gap-2 transition ${
                                isProcessing
                                  ? 'bg-gray-700 text-gray-400 cursor-wait'
                                  : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black'
                              }`}
                            >
                              {isProcessing ? (
                                <> <Loader2 className="w-6 h-6 animate-spin" /> Redeeming... </>
                              ) : (
                                <> <Coins className="w-6 h-6" /> Redeem Now </>
                              )}
                            </button>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {!isConnected && (
          <div className="mt-16 text-center p-10 bg-[#0E1415]/60 rounded-2xl border border-red-800">
            <h3 className="text-2xl font-bold mb-4">Wallet Not Connected</h3>
            <p className="text-lg text-gray-300">
              Connect your wallet to buy perks and redeem vouchers!
            </p>
          </div>
        )}
      </div>
    </section>
  );
}