'use client';

import React, { useState, useMemo, useRef } from 'react';
import Image from 'next/image';
import { BarChart2, Crown, Coins, Wallet, Ticket, ShoppingBag, Loader2, Send, ChevronDown, ChevronUp, Camera, Copy, Check, User, FileText } from 'lucide-react';
import Link from 'next/link';
import avatar from '@/public/avatar.jpg';
import { useAccount, useBalance, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, type Address, type Abi } from 'viem';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { useProfile } from '@/context/ProfileContext';

import { REWARD_CONTRACT_ADDRESSES, TYC_TOKEN_ADDRESS, USDC_TOKEN_ADDRESS, TYCOON_CONTRACT_ADDRESSES } from '@/constants/contracts';
import RewardABI from '@/context/abi/rewardabi.json';
import TycoonABI from '@/context/abi/tycoonabi.json';

const VOUCHER_ID_START = 1_000_000_000;
const COLLECTIBLE_ID_START = 2_000_000_000;

const isVoucherToken = (tokenId: bigint): boolean =>
  tokenId >= VOUCHER_ID_START && tokenId < COLLECTIBLE_ID_START;

const getPerkMetadata = (perk: number) => {
  const data = [
    null,
    { name: 'Extra Turn', icon: <div className="w-16 h-16 bg-yellow-500/20 rounded-2xl flex items-center justify-center text-3xl">⚡</div> },
    { name: 'Get Out of Jail Free', icon: <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center text-3xl">👑</div> },
    { name: 'Double Rent', icon: <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center text-3xl">💰</div> },
    { name: 'Roll Boost', icon: <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center text-3xl">✨</div> },
    { name: 'Instant Cash', icon: <div className="w-16 h-16 bg-cyan-500/20 rounded-2xl flex items-center justify-center text-3xl">💎</div> },
    { name: 'Teleport', icon: <div className="w-16 h-16 bg-pink-500/20 rounded-2xl flex items-center justify-center text-3xl">📍</div> },
    { name: 'Shield', icon: <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-3xl">🛡️</div> },
    { name: 'Property Discount', icon: <div className="w-16 h-16 bg-orange-500/20 rounded-2xl flex items-center justify-center text-3xl">🏠</div> },
    { name: 'Tax Refund', icon: <div className="w-16 h-16 bg-teal-500/20 rounded-2xl flex items-center justify-center text-3xl">↩️</div> },
    { name: 'Exact Roll', icon: <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center text-3xl">🎯</div> },
  ];
  return data[perk] || { name: `Perk #${perk}`, icon: <div className="w-16 h-16 bg-gray-500/20 rounded-2xl flex items-center justify-center text-3xl">?</div> };
};

const MAX_AVATAR_SIZE = 1024 * 1024; // 1MB
const MAX_AVATAR_DIM = 512;

export default function Profile() {
  const { address: walletAddress, isConnected, chainId } = useAccount();
  const { profile, setAvatar, setDisplayName, setBio, setProfile } = useProfile();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendAddress, setSendAddress] = useState('');
  const [sendingTokenId, setSendingTokenId] = useState<bigint | null>(null);
  const [redeemingId, setRedeemingId] = useState<bigint | null>(null);
  const [showVouchers, setShowVouchers] = useState(false);
  const [copied, setCopied] = useState(false);
  const [localDisplayName, setLocalDisplayName] = useState(profile?.displayName ?? '');
  const [localBio, setLocalBio] = useState(profile?.bio ?? '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setLocalDisplayName(profile?.displayName ?? '');
    setLocalBio(profile?.bio ?? '');
  }, [profile?.displayName, profile?.bio]);

  const displayName = profile?.displayName?.trim() || null;

  const { writeContract, data: txHash, isPending: isWriting, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const { data: ethBalance } = useBalance({ address: walletAddress });

  const tycTokenAddress = TYC_TOKEN_ADDRESS[chainId as keyof typeof TYC_TOKEN_ADDRESS];
  const usdcTokenAddress = USDC_TOKEN_ADDRESS[chainId as keyof typeof USDC_TOKEN_ADDRESS];
  const tycoonAddress = TYCOON_CONTRACT_ADDRESSES[chainId as keyof typeof TYCOON_CONTRACT_ADDRESSES];
  const rewardAddress = REWARD_CONTRACT_ADDRESSES[chainId as keyof typeof REWARD_CONTRACT_ADDRESSES] as Address | undefined;

  const tycBalance = useBalance({ address: walletAddress, token: tycTokenAddress, query: { enabled: !!walletAddress && !!tycTokenAddress } });
  const usdcBalance = useBalance({ address: walletAddress, token: usdcTokenAddress, query: { enabled: !!walletAddress && !!usdcTokenAddress } });

  const { data: username } = useReadContract({
    address: tycoonAddress,
    abi: TycoonABI,
    functionName: 'addressToUsername',
    args: walletAddress ? [walletAddress] : undefined,
    query: { enabled: !!walletAddress && !!tycoonAddress },
  });

  const { data: playerData } = useReadContract({
    address: tycoonAddress,
    abi: TycoonABI,
    functionName: 'getUser',
    args: username ? [username as string] : undefined,
    query: { enabled: !!username && !!tycoonAddress },
  });

  // ... (same data fetching logic for ownedCollectibles and myVouchers as before)

  const ownedCount = useReadContract({
    address: rewardAddress,
    abi: RewardABI,
    functionName: 'ownedTokenCount',
    args: walletAddress ? [walletAddress] : undefined,
    query: { enabled: !!walletAddress && !!rewardAddress },
  });

  const ownedCountNum = Number(ownedCount.data ?? 0);

  const tokenCalls = useMemo(() =>
    Array.from({ length: ownedCountNum }, (_, i) => ({
      address: rewardAddress!,
      abi: RewardABI as Abi,
      functionName: 'tokenOfOwnerByIndex',
      args: [walletAddress!, BigInt(i)],
    } as const)),
  [rewardAddress, walletAddress, ownedCountNum]);

  const tokenResults = useReadContracts({
    contracts: tokenCalls,
    query: { enabled: ownedCountNum > 0 && !!rewardAddress && !!walletAddress },
  });

  const allOwnedTokenIds = tokenResults.data
    ?.map(r => r.status === 'success' ? r.result as bigint : null)
    .filter((id): id is bigint => id !== null) ?? [];

  const infoCalls = useMemo(() =>
    allOwnedTokenIds.map(id => ({
      address: rewardAddress!,
      abi: RewardABI as Abi,
      functionName: 'getCollectibleInfo',
      args: [id],
    } as const)),
  [rewardAddress, allOwnedTokenIds]);

  const infoResults = useReadContracts({
    contracts: infoCalls,
    query: { enabled: allOwnedTokenIds.length > 0 },
  });

  const ownedCollectibles = useMemo(() => {
    return infoResults.data?.map((res, i) => {
      if (res?.status !== 'success') return null;
      const [perkNum, strength, , , shopStock] = res.result as [bigint, bigint, bigint, bigint, bigint];
      const perk = Number(perkNum);
      if (perk === 0) return null;

      const tokenId = allOwnedTokenIds[i];
      const meta = getPerkMetadata(perk);

      return {
        tokenId,
        name: meta.name,
        icon: meta.icon,
        strength: Number(strength),
        shopStock: Number(shopStock),
        isTiered: perk === 5 || perk === 9,
      };
    }).filter((c): c is NonNullable<typeof c> => c !== null) ?? [];
  }, [infoResults.data, allOwnedTokenIds]);

  const voucherTokenIds = allOwnedTokenIds.filter(isVoucherToken);

  const voucherInfoCalls = useMemo(() =>
    voucherTokenIds.map(id => ({
      address: rewardAddress!,
      abi: RewardABI as Abi,
      functionName: 'getCollectibleInfo',
      args: [id],
    } as const)),
  [rewardAddress, voucherTokenIds]);

  const voucherInfoResults = useReadContracts({
    contracts: voucherInfoCalls,
    query: { enabled: voucherTokenIds.length > 0 },
  });

  const myVouchers = useMemo(() => {
    return voucherInfoResults.data?.map((res, i) => {
      if (res?.status !== 'success') return null;
      const [, , tycPrice] = res.result as [bigint, bigint, bigint, bigint, bigint];
      return {
        tokenId: voucherTokenIds[i],
        value: formatUnits(tycPrice, 18),
      };
    }).filter((v): v is NonNullable<typeof v> => v !== null) ?? [];
  }, [voucherInfoResults.data, voucherTokenIds]);

  React.useEffect(() => {
    if (playerData && username) {
      const d = playerData as any;
      setUserData({
        username: username || 'Unknown',
        address: walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : '',
        gamesPlayed: Number(d.gamesPlayed || 0),
        wins: Number(d.gamesWon || 0),
        winRate: d.gamesPlayed > 0 ? ((Number(d.gamesWon) / Number(d.gamesPlayed)) * 100).toFixed(1) + '%' : '0%',
        totalEarned: Number(d.totalEarned || 0),
      });
      setLoading(false);
    } else if (playerData === null && !loading) {
      setError('No player data found');
      setLoading(false);
    }
  }, [playerData, username, walletAddress]);

  const handleSend = (tokenId: bigint) => {
    if (!walletAddress || !rewardAddress) return toast.error("Wallet or contract not available");
    if (!sendAddress || !/^0x[a-fA-F0-9]{40}$/i.test(sendAddress)) return toast.error('Invalid wallet address');

    setSendingTokenId(tokenId);
    writeContract({
      address: rewardAddress,
      abi: RewardABI,
      functionName: 'safeTransferFrom',
      args: [walletAddress as `0x${string}`, sendAddress as `0x${string}`, tokenId, 1, '0x'],
    });
  };

  const handleRedeemVoucher = (tokenId: bigint) => {
    if (!rewardAddress) return toast.error("Contract not available");
    setRedeemingId(tokenId);
    writeContract({
      address: rewardAddress,
      abi: RewardABI,
      functionName: 'redeemVoucher',
      args: [tokenId],
    });
  };

  React.useEffect(() => {
    if (txSuccess && txHash) {
      toast.success('Success! 🎉');
      reset();
      setSendingTokenId(null);
      setRedeemingId(null);
      tycBalance.refetch();
    }
  }, [txSuccess, txHash, reset, tycBalance]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file (PNG, JPG, etc.)');
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      toast.error('Image must be under 1MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, MAX_AVATAR_DIM / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setAvatar(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const resized = canvas.toDataURL('image/jpeg', 0.85);
        setAvatar(resized);
        toast.success('Profile photo updated!');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const copyAddress = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    toast.success('Address copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const saveDisplayName = () => {
    const trimmed = localDisplayName.trim() || null;
    setDisplayName(trimmed);
    setProfile({ displayName: trimmed });
    toast.success('Display name saved');
  };

  const saveBio = () => {
    const trimmed = localBio.trim() || null;
    setBio(trimmed);
    setProfile({ bio: trimmed });
    toast.success('Bio saved');
  };

  if (!isConnected || loading || error || !userData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#010F10] via-[#0A1C1E] to-[#0E1415] flex items-center justify-center">
        <div className="text-center space-y-6">
          {!isConnected ? (
            <p className="text-3xl font-bold text-red-400">Wallet not connected</p>
          ) : loading ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-20 h-20 border-4 border-[#00F0FF] border-t-transparent rounded-full mx-auto"
              />
              <p className="text-2xl text-[#00F0FF]">Loading profile...</p>
            </>
          ) : (
            <p className="text-3xl font-bold text-red-400">Error: {error || 'No data'}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-[#F0F7F7] profile-page">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />

      {/* Ambient background */}
      <div className="fixed inset-0 -z-10 bg-[#030c0d]" />
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-cyan-950/25 via-transparent to-transparent" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,240,255,0.08),transparent_50%)]" />

      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#030c0d]/90 backdrop-blur-xl">
        <div className="container mx-auto px-4 sm:px-6 py-4 flex items-center justify-between max-w-5xl">
          <Link href="/" className="flex items-center gap-2 text-cyan-300/90 hover:text-cyan-200 transition text-sm font-medium">
            <span className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">←</span>
            Back
          </Link>
          <h1 className="text-lg font-semibold text-white/90 tracking-tight">My Profile</h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-5xl">
        {/* Hero card — focal point */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative rounded-3xl overflow-hidden mb-8 sm:mb-10 profile-hero"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-teal-500/10" />
          <div className="absolute inset-0 border border-cyan-500/20 rounded-3xl" />
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
              <div className="relative group shrink-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,240,255,0.15)] focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-[#030c0d] block"
                >
                  {profile?.avatar ? (
                    <img src={profile.avatar} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="absolute inset-0 [&>img]:object-cover">
                      <Image src={avatar} alt="Avatar" width={128} height={128} className="w-full h-full object-cover" />
                    </span>
                  )}
                  <span className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="w-12 h-12 rounded-full bg-cyan-500/30 flex items-center justify-center">
                      <Camera className="w-6 h-6 text-white" />
                    </span>
                  </span>
                </button>
                <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg border-2 border-[#030c0d]">
                  <Crown className="w-5 h-5 text-black" />
                </div>
              </div>

              <div className="flex-1 w-full text-center sm:text-left min-w-0">
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight drop-shadow-sm">
                  {userData.username}
                </h2>
                {displayName && (
                  <p className="text-cyan-300/80 text-sm mt-1">"{displayName}"</p>
                )}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-4">
                  <span className="text-slate-400 font-mono text-xs sm:text-sm truncate max-w-full">{walletAddress}</span>
                  <button
                    type="button"
                    onClick={copyAddress}
                    className="p-2 rounded-lg bg-white/5 hover:bg-cyan-500/20 border border-white/10 text-cyan-300 transition shrink-0"
                    title="Copy address"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-row sm:flex-col gap-3 shrink-0 w-full sm:w-auto justify-center sm:justify-start">
                {[
                  { label: 'TYC', value: tycBalance.isLoading ? '...' : Number(tycBalance.data?.formatted || 0).toFixed(2), color: 'cyan' },
                  { label: 'USDC', value: usdcBalance.isLoading ? '...' : Number(usdcBalance.data?.formatted || 0).toFixed(2), color: 'emerald' },
                  { label: 'ETH', value: ethBalance ? Number(ethBalance.formatted).toFixed(4) : '0', color: 'slate' },
                ].map(({ label, value, color }) => (
                  <div key={label} className={`flex-1 sm:flex-none text-center py-3 px-4 rounded-2xl min-w-0 balance-pill balance-${color}`}>
                    <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-white/50">{label}</p>
                    <p className="text-base sm:text-lg font-bold text-white truncate mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
          {[
            { icon: BarChart2, label: 'Games', value: userData.gamesPlayed, accent: 'cyan' },
            { icon: Crown, label: 'Wins', value: `${userData.wins} (${userData.winRate})`, accent: 'amber', valueClass: 'text-amber-300' },
            { icon: Coins, label: 'Earned', value: `${userData.totalEarned} BLOCK`, accent: 'emerald', valueClass: 'text-emerald-300' },
          ].map(({ icon: Icon, label, value, accent, valueClass = 'text-white' }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`profile-stat stat-${accent} rounded-2xl p-4 sm:p-5 flex items-center gap-4`}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 stat-icon">
                <Icon className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-white/50 uppercase tracking-wider">{label}</p>
                <p className={`font-bold text-lg truncate ${valueClass}`}>{value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* About */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="profile-card rounded-2xl p-5 sm:p-6 mb-8"
        >
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-cyan-500" />
            About you
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-3 focus-within:border-cyan-500/30 transition-colors">
              <User className="w-4 h-4 text-cyan-400 shrink-0" />
              <input
                type="text"
                placeholder="Nickname (optional)"
                value={localDisplayName}
                onChange={(e) => setLocalDisplayName(e.target.value)}
                onBlur={saveDisplayName}
                className="flex-1 bg-transparent text-white placeholder-slate-500 focus:outline-none text-sm min-w-0"
              />
              <button type="button" onClick={saveDisplayName} className="text-cyan-400 hover:text-cyan-300 text-sm font-medium shrink-0">Save</button>
            </div>
            <div className="sm:col-span-2 flex gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-3 focus-within:border-cyan-500/30 transition-colors">
              <FileText className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <textarea
                placeholder="Short bio (optional)"
                value={localBio}
                onChange={(e) => setLocalBio(e.target.value)}
                onBlur={saveBio}
                rows={2}
                className="flex-1 bg-transparent text-white placeholder-slate-500 focus:outline-none text-sm resize-none min-w-0"
              />
              <button type="button" onClick={saveBio} className="text-cyan-400 hover:text-cyan-300 text-sm font-medium shrink-0 self-end">Save</button>
            </div>
          </div>
        </motion.section>

        {/* Perks */}
        <section className="mb-10">
          <h3 className="text-sm font-semibold text-white/80 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-purple-500" />
            My Perks <span className="text-white/40 font-normal normal-case">({ownedCollectibles.length})</span>
          </h3>

          {ownedCollectibles.length > 0 && (
            <div className="profile-card rounded-xl p-4 mb-6 max-w-xl border border-purple-500/20">
              <label className="text-xs text-white/50 mb-2 block">Transfer to address</label>
              <input
                type="text"
                placeholder="0x0000...0000"
                value={sendAddress}
                onChange={(e) => setSendAddress(e.target.value.trim())}
                className="w-full px-4 py-3 bg-black/30 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm border border-white/10"
              />
            </div>
          )}

          {ownedCollectibles.length === 0 ? (
            <div className="profile-card rounded-2xl py-14 text-center border border-white/5">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
                <ShoppingBag className="w-8 h-8 text-purple-400/60" />
              </div>
              <p className="text-slate-400 text-sm">No perks yet — visit the shop to collect.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {ownedCollectibles.map((item, i) => (
                <motion.div
                  key={item.tokenId.toString()}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  whileHover={{ y: -4 }}
                  className="profile-card rounded-2xl p-5 text-center border border-white/10 hover:border-purple-500/30 transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.1)]"
                >
                  {item.icon}
                  <h4 className="mt-3 font-semibold text-white text-sm">{item.name}</h4>
                  {item.isTiered && item.strength > 0 && <p className="text-cyan-300/90 text-xs mt-1">Tier {item.strength}</p>}
                  <button
                    onClick={() => handleSend(item.tokenId)}
                    disabled={!sendAddress || !/^0x[a-fA-F0-9]{40}$/i.test(sendAddress) || sendingTokenId === item.tokenId || isWriting || isConfirming}
                    className="mt-4 w-full py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-white"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {sendingTokenId === item.tokenId && (isWriting || isConfirming) ? 'Sending...' : 'Send'}
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Vouchers */}
        <section>
          <button
            onClick={() => setShowVouchers(!showVouchers)}
            className="w-full profile-card rounded-2xl p-5 sm:p-6 border border-amber-500/20 hover:border-amber-500/40 flex items-center justify-between transition-all text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <Ticket className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-amber-200">Reward Vouchers</h3>
                <p className="text-white/50 text-sm">{myVouchers.length} voucher{myVouchers.length !== 1 ? 's' : ''} · {showVouchers ? 'Hide' : 'View & redeem'}</p>
              </div>
            </div>
            {showVouchers ? <ChevronUp className="w-5 h-5 text-amber-400/80 shrink-0" /> : <ChevronDown className="w-5 h-5 text-amber-400/80 shrink-0" />}
          </button>

          <AnimatePresence>
            {showVouchers && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden mt-4"
              >
                {myVouchers.length === 0 ? (
                  <div className="profile-card rounded-2xl py-10 text-center border border-amber-500/10">
                    <Ticket className="w-12 h-12 text-amber-400/30 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">No vouchers yet — keep winning games!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {myVouchers.map((voucher) => (
                      <motion.div
                        key={voucher.tokenId.toString()}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="profile-card rounded-2xl p-5 text-center border border-amber-500/20"
                      >
                        <Ticket className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                        <p className="text-xl font-bold text-amber-200 mb-4">{voucher.value} TYC</p>
                        <button
                          onClick={() => handleRedeemVoucher(voucher.tokenId)}
                          disabled={redeemingId === voucher.tokenId || isWriting || isConfirming}
                          className="w-full py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                          {redeemingId === voucher.tokenId && (isWriting || isConfirming) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coins className="w-4 h-4" />}
                          {redeemingId === voucher.tokenId && (isWriting || isConfirming) ? 'Redeeming...' : 'Redeem'}
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      <style jsx global>{`
        .profile-page .profile-hero {
          background: linear-gradient(135deg, rgba(6, 78, 89, 0.25) 0%, rgba(4, 47, 46, 0.2) 50%, rgba(15, 23, 42, 0.4) 100%);
          backdrop-filter: blur(16px);
          box-shadow: 0 4px 40px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 240, 255, 0.1);
        }
        .profile-page .balance-pill {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(8px);
        }
        .profile-page .balance-cyan { border-color: rgba(0, 240, 255, 0.15); box-shadow: inset 0 0 20px rgba(0, 240, 255, 0.05); }
        .profile-page .balance-emerald { border-color: rgba(52, 211, 153, 0.15); box-shadow: inset 0 0 20px rgba(52, 211, 153, 0.05); }
        .profile-page .balance-slate { border-color: rgba(255, 255, 255, 0.08); }
        .profile-page .profile-stat {
          background: rgba(15, 23, 42, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(8px);
        }
        .profile-page .stat-cyan .stat-icon { background: rgba(0, 240, 255, 0.12); color: rgb(34, 211, 238); }
        .profile-page .stat-amber .stat-icon { background: rgba(251, 191, 36, 0.12); color: rgb(251, 191, 36); }
        .profile-page .stat-emerald .stat-icon { background: rgba(52, 211, 153, 0.12); color: rgb(52, 211, 153); }
        .profile-page .profile-card {
          background: rgba(15, 23, 42, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(12px);
        }
      `}</style>
    </div>
  );
}