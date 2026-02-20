'use client';

import React from 'react';
import { formatUnits } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown,
  DollarSign,
  Wallet,
  Package,
  AlertTriangle,
  Settings,
  PlusCircle,
  Gift,
  Gem,
  Banknote,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Edit2,
  Ticket,
  Star,
  Gamepad2,
} from 'lucide-react';

import {
  CollectiblePerk,
  PERK_NAMES,
  INITIAL_COLLECTIBLES,
} from '@/components/rewards/rewardsConstants';
import { AnimatedCounter } from '@/components/rewards/AnimatedCounter';
import { useRewardsAdmin } from './useRewardsAdmin';

export default function RewardAdminPanel() {
  const {
    auth,
    state,
    contract,
    handlers,
    pending,
  } = useRewardsAdmin();

  const {
    activeSection,
    setActiveSection,
    status,
    isPaused,
    backendMinter,
    owner,
    totalGames,
    totalUsers,
    newMinter,
    setNewMinter,
    voucherRecipient,
    setVoucherRecipient,
    voucherValue,
    setVoucherValue,
    collectibleRecipient,
    setCollectibleRecipient,
    selectedPerk,
    setSelectedPerk,
    collectibleStrength,
    setCollectibleStrength,
    restockTokenId,
    setRestockTokenId,
    restockAmount,
    setRestockAmount,
    updateTokenId,
    setUpdateTokenId,
    updateTycPrice,
    setUpdateTycPrice,
    updateUsdcPrice,
    setUpdateUsdcPrice,
    withdrawToken,
    setWithdrawToken,
    withdrawAmount,
    setWithdrawAmount,
    withdrawTo,
    setWithdrawTo,
    tycoonMinStake,
    setTycoonMinStake,
    tycoonMinTurnsForPerks,
    setTycoonMinTurnsForPerks,
    tycoonGameController,
    setTycoonGameController,
    tycoonReads,
  } = state;

  const { tokenCount, allTokens, tycBalance, usdcBalance } = contract;
  const { anyPending, currentTxHash, pendingMinter, pendingVoucher, pendingCollectible, pendingStock, pendingRestock, pendingUpdate, pendingPause, pendingWithdraw, pendingTycoonMinStake, pendingTycoonMinTurns, pendingTycoonController } = pending;

  if (!auth.isConnected || !auth.userAddress) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0f1a] to-[#0f1a27]">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="p-10 bg-red-950/60 rounded-3xl border border-red-700/50 text-center"
        >
          <AlertTriangle className="w-16 h-16 mx-auto mb-6 text-red-400" />
          <h2 className="text-3xl font-bold">Wallet Not Connected</h2>
          <p className="text-gray-400 mt-2">Connect your wallet to access admin features</p>
        </motion.div>
      </div>
    );
  }

  if (!auth.contractAddress) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0f1a] to-[#0f1a27] text-rose-400 text-2xl">
        No Reward contract deployed on chain {auth.chainId}
      </div>
    );
  }

  if (!auth.isOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0f1a] to-[#0f1a27]">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="p-10 bg-red-950/60 rounded-3xl border border-red-700/50 text-center"
        >
          <AlertTriangle className="w-16 h-16 mx-auto mb-6 text-red-400" />
          <h2 className="text-3xl font-bold">Access Denied</h2>
          <p className="text-gray-400 mt-2">Only the contract owner can access this panel</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f1a] via-[#0d141f] to-[#0f1a27] text-white py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl md:text-6xl font-extrabold mb-4 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            Tycoon Admin Panel
          </h1>
          <p className="text-xl text-gray-400">
            Manage minter • Mint items • Stock shop • Update prices • Control contract
          </p>
        </motion.div>

        <div className="flex flex-wrap justify-center gap-4 mb-10">
          {(['overview', 'mint', 'stock', 'manage', 'tycoon', 'funds'] as const).map((section) => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                activeSection === section
                  ? 'bg-gradient-to-r from-cyan-600 to-purple-600 shadow-lg'
                  : 'bg-gray-800/60 hover:bg-gray-700/50'
              }`}
            >
              {section === 'overview' && <Settings className="w-5 h-5" />}
              {section === 'mint' && <PlusCircle className="w-5 h-5" />}
              {section === 'stock' && <Package className="w-5 h-5" />}
              {section === 'manage' && <Edit2 className="w-5 h-5" />}
              {section === 'tycoon' && <Gamepad2 className="w-5 h-5" />}
              {section === 'funds' && <Wallet className="w-5 h-5" />}
              {section === 'tycoon' ? 'Game Contract' : section.charAt(0).toUpperCase() + section.slice(1)}
            </button>
          ))}
        </div>

        <AnimatePresence>
          {status && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`mb-8 p-6 rounded-2xl border text-center max-w-2xl mx-auto ${
                status.type === 'success'
                  ? 'bg-green-900/40 border-green-600'
                  : status.type === 'error'
                  ? 'bg-red-900/40 border-red-600'
                  : 'bg-blue-900/40 border-blue-600'
              }`}
            >
              <p className="font-medium">{status.message}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {activeSection === 'overview' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Settings className="w-6 h-6 text-cyan-400" /> Contract Status
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-lg">
                <div>
                  Paused: <span className={isPaused ? 'text-red-400' : 'text-green-400'}>{isPaused ? 'Yes' : 'No'}</span>
                </div>
                <div>
                  Owner: <span className="font-mono text-sm">{owner ? `${owner.slice(0, 8)}...${owner.slice(-6)}` : '—'}</span>
                </div>
                <div>
                  Backend Minter: <span className="font-mono text-sm">{backendMinter ? `${backendMinter.slice(0, 8)}...${backendMinter.slice(-6)}` : 'Not set'}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Crown className="w-6 h-6 text-purple-400" /> Platform Statistics
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-lg">
                <div>
                  Total Games Created: <motion.span className="text-green-400 font-bold" initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ duration: 0.5 }}><AnimatedCounter to={totalGames} /></motion.span>
                </div>
                <div>
                  Total Users Registered: <motion.span className="text-green-400 font-bold" initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ duration: 0.5 }}><AnimatedCounter to={totalUsers} /></motion.span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-bold mb-8 flex items-center gap-3">
                <Package className="w-8 h-8 text-purple-400" /> Contract Token Holdings
              </h3>

              {tokenCount === 0 ? (
                <div className="text-center py-20 text-gray-400">
                  <Package className="w-20 h-20 mx-auto mb-4 opacity-30" />
                  <p>No tokens held by contract yet</p>
                </div>
              ) : allTokens.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                  <div className="animate-pulse">Loading {tokenCount} tokens...</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {allTokens.map((item) => (
                    <motion.div
                      key={item.tokenId.toString()}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.05 }}
                      className={`relative overflow-hidden rounded-2xl border-2 p-6 text-center transition-all ${
                        item.type === 'voucher'
                          ? 'bg-gradient-to-br from-amber-900/40 to-orange-900/40 border-amber-600'
                          : 'bg-gradient-to-br from-purple-900/40 to-pink-900/40 border-purple-600'
                      }`}
                    >
                      <div className="absolute inset-0 bg-white/5 backdrop-blur-xl" />
                      <div className="relative z-10">
                        <div className={`mx-auto mb-4 p-4 rounded-full ${item.type === 'voucher' ? 'bg-amber-900/60' : 'bg-purple-900/60'}`}>
                          {item.type === 'voucher' ? <Ticket className="w-12 h-12" /> : <Star className="w-12 h-12" />}
                        </div>
                        <h4 className="font-bold text-lg mb-2 truncate">{item.name}</h4>
                        <p className="text-xs opacity-80 mb-4">ID: {item.tokenId.toString()}</p>
                        <div className="text-2xl font-bold text-emerald-400">{item.stock.toString()}</div>
                        <p className="text-xs opacity-75">In Stock</p>

                        {item.type === 'collectible' && item.tycPrice > 0 && (
                          <div className="mt-4 pt-4 border-t border-white/20">
                            {/* <p className="text-xs">
                              <span className="text-emerald-300">{formatUnits(item.tycPrice, 18)}</span> TYC
                            </p> */}
                            <p className="text-xs">
                              <span className="text-cyan-300">{formatUnits(item.usdcPrice, 6)}</span> USDC
                            </p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeSection === 'mint' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Gift className="w-6 h-6 text-blue-400" /> Mint Voucher
              </h3>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Recipient Address"
                  value={voucherRecipient}
                  onChange={(e) => setVoucherRecipient(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  placeholder="TYC Value (e.g. 10)"
                  value={voucherValue}
                  onChange={(e) => setVoucherValue(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handlers.handleMintVoucher}
                  disabled={anyPending || !voucherRecipient || !voucherValue}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition disabled:opacity-50"
                >
                  {pendingVoucher ? 'Minting...' : 'Mint Voucher'}
                </button>
              </div>
            </div>

            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Gem className="w-6 h-6 text-purple-400" /> Mint Collectible
              </h3>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Recipient Address"
                  value={collectibleRecipient}
                  onChange={(e) => setCollectibleRecipient(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <select
                  value={selectedPerk}
                  onChange={(e) => setSelectedPerk(Number(e.target.value) as CollectiblePerk)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                >
                  {Object.entries(PERK_NAMES).map(([value, name]) => (
                    <option key={value} value={value}>
                      {name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Strength (for tiered perks)"
                  value={collectibleStrength}
                  onChange={(e) => setCollectibleStrength(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={handlers.handleMintCollectible}
                  disabled={anyPending || !collectibleRecipient}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold transition disabled:opacity-50"
                >
                  {pendingCollectible ? 'Minting...' : 'Mint Collectible'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeSection === 'stock' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-2 justify-center">
              <Package className="w-8 h-8 text-green-400" /> Stock Shop (50 Units Each)
            </h3>
            <p className="text-center text-gray-400 mb-8">
              Click any item to stock 50 units with pre-set prices
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {INITIAL_COLLECTIBLES.map((item) => (
                <motion.div
                  key={`${item.perk}-${item.strength}`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  className="rounded-2xl p-6 border-2 cursor-pointer transition-all text-center bg-gray-800/40 border-gray-700 hover:border-green-500/50"
                  onClick={() => {
                    setSelectedPerk(item.perk);
                    setCollectibleStrength(String(item.strength));
                  }}
                >
                  <div className="flex flex-col items-center mb-4">
                    <div className="p-4 rounded-full mb-3 bg-gray-700/50">
                      {item.icon}
                    </div>
                    <h4 className="font-bold text-lg">{item.name}</h4>
                    {item.strength > 1 && <p className="text-sm text-gray-400">Tier {item.strength}</p>}
                  </div>

                  <div className="space-y-2 mb-4">
                    <p className="text-sm text-emerald-300">
                      <span className="font-semibold">{item.tycPrice} TYC</span>
                    </p>
                    <p className="text-sm text-cyan-300 font-semibold">
                      {item.usdcPrice} USDC
                    </p>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlers.handleStockShop(item.perk, item.strength);
                    }}
                    disabled={anyPending}
                    className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-xl font-bold transition disabled:opacity-50 shadow-md"
                  >
                    {pendingStock ? 'Stocking...' : 'Stock 50 Units'}
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {activeSection === 'manage' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Settings className="w-6 h-6 text-yellow-400" /> Set Backend Minter
              </h3>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="New Minter Address"
                  value={newMinter}
                  onChange={(e) => setNewMinter(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
                <button
                  onClick={handlers.handleSetBackendMinter}
                  disabled={anyPending || !newMinter}
                  className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 rounded-xl font-bold transition disabled:opacity-50"
                >
                  {pendingMinter ? 'Setting...' : 'Set Minter'}
                </button>
              </div>
            </div>

            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <PauseCircle className="w-6 h-6 text-red-400" /> Contract Control
              </h3>
              <div className="flex gap-4">
                <button
                  onClick={() => handlers.pause()}
                  disabled={anyPending || isPaused}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-bold transition disabled:opacity-50"
                >
                  {pendingPause ? 'Pausing...' : 'Pause'}
                </button>
                <button
                  onClick={() => handlers.unpause()}
                  disabled={anyPending || !isPaused}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-500 rounded-xl font-bold transition disabled:opacity-50"
                >
                  {pendingPause ? 'Unpausing...' : 'Unpause'}
                </button>
              </div>
            </div>

            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <RefreshCw className="w-6 h-6 text-blue-400" /> Restock Collectible
              </h3>
              <div className="space-y-4">
                <input
                  type="number"
                  placeholder="Token ID"
                  value={restockTokenId}
                  onChange={(e) => setRestockTokenId(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  placeholder="Amount to Add"
                  value={restockAmount}
                  onChange={(e) => setRestockAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handlers.handleRestock}
                  disabled={anyPending || !restockTokenId || !restockAmount}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition disabled:opacity-50"
                >
                  {pendingRestock ? 'Restocking...' : 'Restock'}
                </button>
              </div>
            </div>

            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-green-400" /> Update Prices
              </h3>
              <div className="space-y-4">
                <input
                  type="number"
                  placeholder="Token ID"
                  value={updateTokenId}
                  onChange={(e) => setUpdateTokenId(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="New TYC Price"
                  value={updateTycPrice}
                  onChange={(e) => setUpdateTycPrice(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="New USDC Price"
                  value={updateUsdcPrice}
                  onChange={(e) => setUpdateUsdcPrice(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  onClick={handlers.handleUpdatePrices}
                  disabled={anyPending || !updateTokenId}
                  className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-xl font-bold transition disabled:opacity-50"
                >
                  {pendingUpdate ? 'Updating...' : 'Update Prices'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeSection === 'tycoon' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-8">
            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                <Gamepad2 className="w-8 h-8 text-cyan-400" /> Tycoon Game Contract
              </h3>
              <p className="text-gray-400 mb-6">
                Owner-only settings. Min stake is in USDC (e.g. 1 = 1 USDC). Game controller can call removePlayerFromGame, setTurnCount, transferPropertyOwnership.
              </p>
              {tycoonReads.isLoading ? (
                <div className="text-gray-400">Loading...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-600/50">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Min Stake (USDC)</label>
                    <p className="text-xs text-gray-500 mb-2">Minimum USDC per player to join a staked game (6 decimals).</p>
                    <input
                      type="text"
                      placeholder="e.g. 1"
                      value={tycoonMinStake}
                      onChange={(e) => setTycoonMinStake(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 mb-3"
                    />
                    <button
                      onClick={handlers.handleSetTycoonMinStake}
                      disabled={anyPending || !tycoonMinStake}
                      className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl font-bold transition disabled:opacity-50"
                    >
                      {pendingTycoonMinStake ? 'Updating...' : 'Set Min Stake'}
                    </button>
                  </div>
                  <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-600/50">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Min Turns for Perks</label>
                    <p className="text-xs text-gray-500 mb-2">Minimum turns played to get full exit perks (0 = disabled).</p>
                    <input
                      type="number"
                      min="0"
                      placeholder={tycoonReads.minTurnsForPerks?.toString() ?? '0'}
                      value={tycoonMinTurnsForPerks}
                      onChange={(e) => setTycoonMinTurnsForPerks(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 mb-3"
                    />
                    <button
                      onClick={handlers.handleSetTycoonMinTurnsForPerks}
                      disabled={anyPending || tycoonMinTurnsForPerks === ''}
                      className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl font-bold transition disabled:opacity-50"
                    >
                      {pendingTycoonMinTurns ? 'Updating...' : 'Set Min Turns'}
                    </button>
                  </div>
                  <div className="md:col-span-2 bg-gray-800/50 rounded-xl p-6 border border-gray-600/50">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Backend Game Controller</label>
                    <p className="text-xs text-gray-500 mb-2">Address allowed to call removePlayerFromGame, setTurnCount, transferPropertyOwnership. Use 0x0 to clear.</p>
                    <input
                      type="text"
                      placeholder="0x..."
                      value={tycoonGameController}
                      onChange={(e) => setTycoonGameController(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 mb-3 font-mono text-sm"
                    />
                    <button
                      onClick={handlers.handleSetTycoonGameController}
                      disabled={anyPending || !tycoonGameController.trim()}
                      className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl font-bold transition disabled:opacity-50"
                    >
                      {pendingTycoonController ? 'Updating...' : 'Set Game Controller'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeSection === 'funds' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Banknote className="w-6 h-6 text-yellow-400" /> Withdraw Funds
            </h3>
            <div className="space-y-4">
              <select
                value={withdrawToken}
                onChange={(e) => setWithdrawToken(e.target.value as 'TYC' | 'USDC')}
                className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 text-white"
              >
                <option value="TYC">TYC</option>
                <option value="USDC">USDC</option>
              </select>
              <input
                type="number"
                step="0.01"
                placeholder="Amount"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
              <input
                type="text"
                placeholder="Recipient Address"
                value={withdrawTo}
                onChange={(e) => setWithdrawTo(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
              <button
                onClick={handlers.handleWithdraw}
                disabled={anyPending || !withdrawAmount || !withdrawTo}
                className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 rounded-xl font-bold transition disabled:opacity-50"
              >
                {pendingWithdraw ? 'Withdrawing...' : 'Withdraw'}
              </button>
            </div>
          </motion.div>
        )}

        {currentTxHash && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 p-6 bg-green-900/90 rounded-2xl border border-green-600 shadow-2xl z-50"
          >
            <p className="text-xl font-bold text-green-300 text-center">Transaction Sent!</p>
            <a
              href={`https://celoscan.io/tx/${currentTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-3 text-cyan-300 underline text-center"
            >
              View on Block Explorer
            </a>
          </motion.div>
        )}
      </div>
    </div>
  );
}