import { Game, GameProperty, Player, Property } from "@/types/game";
import { useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { useDevGameTools } from "@/hooks/useDevGameTools";

interface ClaimPropertyModalProps {
  open: boolean;
  game_properties: GameProperty[];
  properties: Property[];
  me: Player | null;
  game: Game;
  onClose: () => void;
  onClaim: (propertyId: number, player: Player) => Promise<unknown>;
  onDelete: (id: number) => Promise<void>;
  onTransfer: (propertyId: number, newPlayerId: number, player_address: string) => Promise<void>;
}

const MONOPOLY_STATS = {
  colorGroups: {
    brown: [1, 3],
    lightblue: [6, 8, 9],
    pink: [11, 13, 14],
    orange: [16, 18, 19],
    red: [21, 23, 24],
    yellow: [26, 27, 29],
    green: [31, 32, 34],
    darkblue: [37, 39],
    railroad: [5, 15, 25, 35],
    utility: [12, 28],
  },
};

const GROUP_COLORS: Record<string, string> = {
  brown: "border-amber-900 bg-amber-900/20",
  lightblue: "border-cyan-400 bg-cyan-400/20",
  pink: "border-pink-500 bg-pink-500/20",
  orange: "border-orange-500 bg-orange-500/20",
  red: "border-red-500 bg-red-500/20",
  yellow: "border-yellow-400 bg-yellow-400/20",
  green: "border-green-500 bg-green-500/20",
  darkblue: "border-blue-800 bg-blue-800/20",
  railroad: "border-gray-400 bg-gray-400/20",
  utility: "border-purple-400 bg-purple-400/20",
};

const PERKS = [
  { id: 1, name: "Extra Turn", desc: "Get +1 extra turn!" },
  { id: 2, name: "Jail Free Card", desc: "Escape jail instantly!" },
  { id: 3, name: "Double Rent", desc: "Next rent doubled!" },
  { id: 4, name: "Roll Boost", desc: "Bonus to next roll!" },
  { id: 5, name: "Instant Cash", desc: "Burn for tiered TYC!" },
  { id: 6, name: "Teleport", desc: "Move to any property!" },
  { id: 7, name: "Shield", desc: "Protect from rent/fees!" },
  { id: 8, name: "Property Discount", desc: "30-50% off next buy!" },
  { id: 9, name: "Tax Refund", desc: "Tiered tax cash back!" },
  { id: 10, name: "Exact Roll", desc: "Choose exact roll 2-12!" },
];

export default function ClaimPropertyModal({
  open,
  game_properties,
  properties,
  me,
  game,
  onClose,
  onClaim,
  onDelete,
  onTransfer,
}: ClaimPropertyModalProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [targetPlayerId, setTargetPlayerId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"claim" | "delete" | "transfer" | "overview" | "cash" | "move" | "perks">("claim");

  const {
    cashTargetPlayerId,
    setCashTargetPlayerId,
    cashAmount,
    setCashAmount,
    isAdjustingCash,
    adjustCash,

    positionTargetPlayerId,
    setPositionTargetPlayerId,
    newPosition,
    setNewPosition,
    isChangingPosition,
    changePlayerPosition,

    perkTargetPlayerId,
    setPerkTargetPlayerId,
    selectedPerkId,
    setSelectedPerkId,
    teleportPosition,
    setTeleportPosition,
    exactRollValue,
    setExactRollValue,
    isActivatingPerk,
    activatePerk,
    getPerkName,
  } = useDevGameTools({ game, game_properties });

  if (!open || !me) return null;

  const allProperties = game_properties
    .map(gp => ({
      ...gp,
      base: properties.find(p => p.id === gp.property_id),
    }))
    .filter((gp): gp is typeof gp & { base: Property } => !!gp.base)
    .sort((a, b) => (b.base.price || 0) - (a.base.price || 0));

  const selected = selectedId ? allProperties.find(gp => gp.id === selectedId) : null;

  const currentOwner = selected
    ? game.players.find(p => p.address?.toLowerCase() === selected.address?.toLowerCase()) ||
      (selected.address === "bank" ? { username: "Bank" } : { username: selected.address?.slice(0, 8) + "..." })
    : null;

  const getRecipientPlayerId = (walletAddress: string): number | null => {
    const owned = game_properties.find(
      gp => gp.address?.toLowerCase() === walletAddress.toLowerCase()
    );
    return owned?.player_id ?? null;
  };

  const eligibleRecipients = game.players.filter(player => {
    if (player.user_id === me.user_id) return false;
    return game_properties.some(
      gp => gp.address?.toLowerCase() === player.address?.toLowerCase()
    );
  });

  const getOwnerName = (address: string | null | undefined) => {
    if (!address || address === "bank") return "Bank";
    const player = game.players.find(p => p.address?.toLowerCase() === address.toLowerCase());
    return player?.username || address.slice(0, 8) + "...";
  };

  const overviewData = Object.entries(MONOPOLY_STATS.colorGroups).map(([groupName, propertyIds]) => {
    const total = propertyIds.length;
    const ownership: Record<string, number> = {};
    const missing: { id: number; name: string; owner: string }[] = [];

    propertyIds.forEach(id => {
      const gp = game_properties.find(g => g.property_id === id);
      const prop = properties.find(p => p.id === id);
      const ownerAddr = gp?.address || "bank";
      const ownerName = getOwnerName(ownerAddr);

      if (!gp) {
        missing.push({ id, name: prop?.name || `Property ${id}`, owner: "Bank" });
      }

      ownership[ownerName] = (ownership[ownerName] || 0) + 1;
    });

    let maxOwned = 0;
    let maxPlayer = "";
    Object.entries(ownership).forEach(([player, count]) => {
      if (count > maxOwned) {
        maxOwned = count;
        maxPlayer = player;
      }
    });

    const isComplete = maxOwned === total && maxPlayer !== "Bank";
    const needs = total - maxOwned;
    const isNearComplete = (needs === 1 || needs === 2) && maxPlayer !== "Bank";

    return {
      groupName,
      total,
      ownership,
      missing,
      isComplete,
      isNearComplete,
      needs,
      dominantPlayer: maxPlayer,
    };
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-gray-900 border border-cyan-500/50 rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl shadow-cyan-500/20"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-cyan-800/40 bg-gradient-to-r from-cyan-900/20 to-purple-900/20 flex-shrink-0">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold text-cyan-300">DEV Tools: Game Control</h2>
              <p className="text-cyan-400/70 text-sm mt-1">Property, cash, position, and all 10 perks</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl font-light transition">
              ×
            </button>
          </div>
        </div>

        <div className="flex gap-1 border-b border-gray-700 px-6 pt-4 flex-wrap">
          <button onClick={() => setActiveTab("claim")} className={`px-6 py-3 font-medium transition rounded-t-lg ${activeTab === "claim" ? "text-cyan-300 bg-cyan-900/30 border-b-3 border-cyan-300" : "text-gray-500 hover:text-white"}`}>Claim to Self</button>
          <button onClick={() => setActiveTab("delete")} className={`px-6 py-3 font-medium transition rounded-t-lg ${activeTab === "delete" ? "text-red-400 bg-red-900/20 border-b-3 border-red-400" : "text-gray-500 hover:text-white"}`}>Return to Bank</button>
          <button onClick={() => setActiveTab("transfer")} className={`px-6 py-3 font-medium transition rounded-t-lg ${activeTab === "transfer" ? "text-purple-400 bg-purple-900/20 border-b-3 border-purple-400" : "text-gray-500 hover:text-white"}`}>Transfer</button>
          <button onClick={() => setActiveTab("overview")} className={`px-6 py-3 font-medium transition rounded-t-lg ${activeTab === "overview" ? "text-green-400 bg-green-900/20 border-b-3 border-green-400" : "text-gray-500 hover:text-white"}`}>Monopoly Overview</button>
          <button onClick={() => { setActiveTab("cash"); setSelectedId(null); }} className={`px-6 py-3 font-medium transition rounded-t-lg ${activeTab === "cash" ? "text-yellow-400 bg-yellow-900/20 border-b-3 border-yellow-400" : "text-gray-500 hover:text-white"}`}>Adjust Cash</button>
          <button onClick={() => { setActiveTab("move"); setSelectedId(null); }} className={`px-6 py-3 font-medium transition rounded-t-lg ${activeTab === "move" ? "text-orange-400 bg-orange-900/20 border-b-3 border-orange-400" : "text-gray-500 hover:text-white"}`}>Change Position</button>
          <button onClick={() => { setActiveTab("perks"); setSelectedId(null); }} className={`px-6 py-3 font-medium transition rounded-t-lg ${activeTab === "perks" ? "text-pink-400 bg-pink-900/20 border-b-3 border-pink-400" : "text-gray-500 hover:text-white"}`}>Activate Perks</button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {activeTab !== "overview" && activeTab !== "cash" && activeTab !== "move" && activeTab !== "perks" && (
            <div className="w-full md:w-1/2 border-b md:border-b-0 md:border-r border-cyan-800/30 flex flex-col">
              <div className="p-6 flex-shrink-0">
                <h3 className="text-lg font-semibold text-white">Select Property ({allProperties.length})</h3>
              </div>
              <div className="flex-1 overflow-y-auto px-6 pb-6">
                {allProperties.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">No properties in game</div>
                ) : (
                  <div className="space-y-3">
                    {allProperties.map(({ id, base, address }) => {
                      const owner = getOwnerName(address);
                      const isSelected = selectedId === id;
                      return (
                        <button
                          key={id}
                          onClick={() => { setSelectedId(id); setTargetPlayerId(null); }}
                          className={`w-full p-5 rounded-xl border-2 text-left transition-all ${isSelected ? "border-cyan-400 bg-cyan-900/40 shadow-lg shadow-cyan-500/40 ring-2 ring-cyan-400/50" : "border-gray-700 hover:border-cyan-600/70 bg-gray-800/40"}`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-bold text-xl text-white">{base.name}</div>
                              <div className="text-cyan-300 mt-1">Price: ${base.price?.toLocaleString()}</div>
                              <div className="text-sm text-gray-400 mt-2">Owner: <span className="text-cyan-200 font-medium">{owner}</span></div>
                            </div>
                            {isSelected && <span className="text-3xl text-cyan-400 ml-4">✓</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className={`w-full ${activeTab !== "overview" && activeTab !== "cash" && activeTab !== "move" && activeTab !== "perks" ? "md:w-1/2" : ""} flex flex-col`}>
            <div className="flex-1 p-6 overflow-y-auto">
              {activeTab === "overview" ? (
                <div className="space-y-6">
                  <h3 className="text-2xl font-bold text-green-300 mb-6">Monopoly Status Overview</h3>
                  {overviewData.map(({ groupName, total, ownership, missing, isComplete, isNearComplete, needs, dominantPlayer }) => (
                    <div key={groupName} className={`p-5 rounded-xl border-2 ${GROUP_COLORS[groupName]} ${isComplete ? "ring-4 ring-green-400 shadow-lg shadow-green-400/50" : ""} ${isNearComplete ? "ring-4 ring-yellow-400 shadow-lg shadow-yellow-400/50" : ""}`}>
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-xl font-bold text-white capitalize">{groupName.replace(/([A-Z])/g, ' $1').trim()} ({total})</h4>
                        <div className="text-right">
                          {isComplete && <span className="text-green-400 font-bold text-lg">COMPLETE MONOPOLY</span>}
                          {isNearComplete && <span className="text-yellow-400 font-bold text-lg">Needs {needs}</span>}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                        {Object.entries(ownership).map(([player, count]) => (
                          <div key={player} className={player === dominantPlayer ? "text-white font-bold" : "text-gray-300"}>
                            {player}: {count}/{total}
                          </div>
                        ))}
                      </div>
                      {missing.length > 0 && (
                        <div className="mt-3">
                          <p className="text-sm text-gray-400 font-medium">Missing:</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {missing.map(m => (
                              <span key={m.id} className="text-xs bg-gray-800 px-3 py-1 rounded-full">
                                {m.name} ({m.owner})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : activeTab === "cash" ? (
                <div className="space-y-8">
                  <h3 className="text-2xl font-bold text-yellow-300">Adjust Player Cash Balance</h3>
                  <div className="space-y-6 max-w-lg mx-auto">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Select Player</label>
                      <select value={cashTargetPlayerId ?? ""} onChange={(e) => setCashTargetPlayerId(e.target.value ? Number(e.target.value) : null)} className="w-full bg-gray-800 p-4 rounded-xl border border-gray-600 text-white focus:border-yellow-500 focus:outline-none transition text-base">
                        <option value="">Choose a player...</option>
                        {game.players.map(player => (
                          <option key={player.user_id} value={player.user_id}>
                            {player.username} — Current: ${player.balance.toLocaleString()}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Amount (positive = add, negative = subtract)</label>
                      <input type="number" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} placeholder="e.g. 500 or -200" className="w-full bg-gray-800 p-4 rounded-xl border border-gray-600 text-white focus:border-yellow-500 focus:outline-none transition text-xl font-mono" />
                      <p className="text-xs text-gray-500 mt-2">Positive to give money · Negative to take money</p>
                    </div>
                    <button
                      onClick={adjustCash}
                      disabled={isAdjustingCash || !cashTargetPlayerId || cashAmount === "" || isNaN(Number(cashAmount)) || Number(cashAmount) === 0}
                      className="w-full py-5 bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-bold text-xl shadow-lg shadow-yellow-600/40 transition transform hover:scale-105 disabled:hover:scale-100"
                    >
                      {isAdjustingCash ? "Adjusting..." : "Apply Cash Adjustment"}
                    </button>
                  </div>
                </div>
              ) : activeTab === "move" ? (
                <div className="space-y-8">
                  <h3 className="text-2xl font-bold text-orange-300">Change Player Position</h3>
                  <div className="space-y-6 max-w-lg mx-auto">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Select Player</label>
                      <select value={positionTargetPlayerId ?? ""} onChange={(e) => setPositionTargetPlayerId(e.target.value ? Number(e.target.value) : null)} className="w-full bg-gray-800 p-4 rounded-xl border border-gray-600 text-white focus:border-orange-500 focus:outline-none transition text-base">
                        <option value="">Choose a player...</option>
                        {game.players.map(player => (
                          <option key={player.user_id} value={player.user_id}>
                            {player.username} — Current: {player.position}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">New Position (0–39)</label>
                      <input type="number" min="0" max="39" value={newPosition} onChange={(e) => setNewPosition(e.target.value)} placeholder="e.g. 10 = Jail, 0 = GO" className="w-full bg-gray-800 p-4 rounded-xl border border-gray-600 text-white focus:border-orange-500 focus:outline-none transition text-xl font-mono" />
                    </div>
                    <button
                      onClick={changePlayerPosition}
                      disabled={isChangingPosition || !positionTargetPlayerId || newPosition === "" || isNaN(Number(newPosition)) || Number(newPosition) < 0 || Number(newPosition) > 39}
                      className="w-full py-5 bg-gradient-to-r from-orange-600 to-red-500 hover:from-orange-500 hover:to-red-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-bold text-xl shadow-lg shadow-orange-600/40 transition transform hover:scale-105 disabled:hover:scale-100"
                    >
                      {isChangingPosition ? "Updating..." : "Update Position"}
                    </button>
                  </div>
                </div>
              ) : activeTab === "perks" ? (
                <div className="space-y-8">
                  <h3 className="text-2xl font-bold text-pink-300">Activate Perks (All 10)</h3>
                  <div className="space-y-6 max-w-2xl mx-auto">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Select Player</label>
                      <select value={perkTargetPlayerId ?? ""} onChange={(e) => setPerkTargetPlayerId(e.target.value ? Number(e.target.value) : null)} className="w-full bg-gray-800 p-4 rounded-xl border border-gray-600 text-white focus:border-pink-500 focus:outline-none transition text-base">
                        <option value="">Choose a player...</option>
                        {game.players.map(player => (
                          <option key={player.user_id} value={player.user_id}>
                            {player.username}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Select Perk</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {PERKS.map(perk => (
                          <button
                            key={perk.id}
                            onClick={() => setSelectedPerkId(perk.id)}
                            className={`p-4 rounded-xl border-2 text-left transition-all ${
                              selectedPerkId === perk.id
                                ? "border-pink-400 bg-pink-900/40 shadow-lg shadow-pink-500/40"
                                : "border-gray-700 hover:border-pink-600/70 bg-gray-800/40"
                            }`}
                          >
                            <div className="font-bold text-white">{perk.name}</div>
                            <div className="text-sm text-gray-400">{perk.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {(selectedPerkId === 6) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Teleport Position (0–39)</label>
                        <input type="number" min="0" max="39" value={teleportPosition} onChange={(e) => setTeleportPosition(e.target.value)} placeholder="Enter position" className="w-full bg-gray-800 p-4 rounded-xl border border-gray-600 text-white focus:border-pink-500 focus:outline-none transition text-xl font-mono" />
                      </div>
                    )}

                    {(selectedPerkId === 10) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Exact Roll Value (2–12)</label>
                        <input type="number" min="2" max="12" value={exactRollValue} onChange={(e) => setExactRollValue(e.target.value)} placeholder="Enter roll" className="w-full bg-gray-800 p-4 rounded-xl border border-gray-600 text-white focus:border-pink-500 focus:outline-none transition text-xl font-mono" />
                      </div>
                    )}

                    <button
                      onClick={activatePerk}
                      disabled={isActivatingPerk || !perkTargetPlayerId || !selectedPerkId}
                      className="w-full py-5 bg-gradient-to-r from-pink-600 to-purple-500 hover:from-pink-500 hover:to-purple-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-bold text-xl shadow-lg shadow-pink-600/40 transition transform hover:scale-105 disabled:hover:scale-100"
                    >
                      {isActivatingPerk ? "Activating..." : "Activate Selected Perk"}
                    </button>
                  </div>
                </div>
              ) : !selected ? (
                <div className="h-full flex items-center justify-center text-gray-500">
                  <p className="text-xl text-center">← Select a property from the list to manage it</p>
                </div>
              ) : (
                <div className="space-y-6 flex-1 flex flex-col">
                  <div className="p-5 bg-gradient-to-br from-cyan-900/30 to-purple-900/30 rounded-xl border border-cyan-600/50 flex-shrink-0">
                    <h4 className="text-xl font-bold text-white">{selected.base.name}</h4>
                    <p className="text-cyan-300">Price: ${selected.base.price?.toLocaleString()}</p>
                    <p className="text-sm text-gray-300 mt-2">Current owner: <span className="text-cyan-200 font-medium">{currentOwner?.username}</span></p>
                  </div>
                  <div className="flex-1 flex items-start justify-center">
                    <div className="w-full max-w-sm space-y-4">
                      {activeTab === "claim" && (
                        <button onClick={() => onClaim(selected.id, me)} className="w-full py-5 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 rounded-xl text-white font-bold text-xl shadow-lg shadow-cyan-600/40 transition transform hover:scale-105">
                          Claim {selected.base.name} for Yourself
                        </button>
                      )}
                      {activeTab === "delete" && (
                        <button onClick={() => onDelete(selected.id)} className="w-full py-5 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 rounded-xl text-white font-bold text-xl shadow-lg shadow-red-600/40 transition transform hover:scale-105">
                          Return {selected.base.name} to Bank
                        </button>
                      )}
                      {activeTab === "transfer" && (
                        <>
                          <select value={targetPlayerId ?? ""} onChange={(e) => setTargetPlayerId(e.target.value ? Number(e.target.value) : null)} className="w-full bg-gray-800 p-4 rounded-xl border border-gray-600 text-white focus:border-purple-500 focus:outline-none transition text-base">
                            <option value="">Choose recipient player...</option>
                            {eligibleRecipients.map(player => (
                              <option key={player.user_id} value={player.user_id}>
                                {player.username} ({player.address?.slice(0, 6)}...{player.address?.slice(-4)})
                              </option>
                            ))}
                          </select>
                          {eligibleRecipients.length === 0 && <p className="text-sm text-gray-400 text-center">No eligible recipients (must already own a property)</p>}
                          <button
                            disabled={!targetPlayerId}
                            onClick={() => {
                              if (!targetPlayerId || !selected) return;
                              const targetPlayer = game.players.find(p => p.user_id === targetPlayerId);
                              if (!targetPlayer?.address) { toast.error("Recipient has no wallet address"); return; }
                              const realPlayerId = getRecipientPlayerId(targetPlayer.address);
                              if (!realPlayerId) { toast.error("Could not find valid player_id for recipient"); return; }
                              onTransfer(selected.id, realPlayerId, targetPlayer.address);
                            }}
                            className="w-full py-5 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-bold text-xl shadow-lg shadow-purple-600/40 transition transform hover:scale-105 disabled:hover:scale-100"
                          >
                            Transfer to Selected Player
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}