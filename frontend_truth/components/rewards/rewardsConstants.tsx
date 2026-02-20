import {
  Zap,
  Sparkles,
  Coins,
  Shield,
  Gem,
  Ticket,
  Star,
  KeyRound,
} from "lucide-react";
export enum CollectiblePerk {
  NONE = 0,
  EXTRA_TURN = 1,
  JAIL_FREE = 2,
  DOUBLE_RENT = 3,
  ROLL_BOOST = 4,
  CASH_TIERED = 5,
  TELEPORT = 6,
  SHIELD = 7,
  PROPERTY_DISCOUNT = 8,
  TAX_REFUND = 9,
  ROLL_EXACT = 10,
}

export const PERK_NAMES: Record<CollectiblePerk, string> = {
  [CollectiblePerk.NONE]: "None",
  [CollectiblePerk.EXTRA_TURN]: "Extra Turn",
  [CollectiblePerk.JAIL_FREE]: "Get Out of Jail Free",
  [CollectiblePerk.DOUBLE_RENT]: "Double Rent",
  [CollectiblePerk.ROLL_BOOST]: "Roll Boost",
  [CollectiblePerk.CASH_TIERED]: "Instant Cash (Tiered)",
  [CollectiblePerk.TELEPORT]: "Teleport",
  [CollectiblePerk.SHIELD]: "Shield",
  [CollectiblePerk.PROPERTY_DISCOUNT]: "Property Discount",
  [CollectiblePerk.TAX_REFUND]: "Tax Refund (Tiered)",
  [CollectiblePerk.ROLL_EXACT]: "Exact Roll",
};

export const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
  },
] as const;

export const INITIAL_COLLECTIBLES: readonly {
  perk: CollectiblePerk;
  name: string;
  strength: number;
  tycPrice: string;
  usdcPrice: string;
  icon: React.ReactNode;
}[] = [
  { perk: CollectiblePerk.EXTRA_TURN, name: "Extra Turn", strength: 1, tycPrice: "0.75", usdcPrice: "0.08", icon: <Zap className="w-8 h-8" /> },
  { perk: CollectiblePerk.JAIL_FREE, name: "Get Out of Jail Free", strength: 1, tycPrice: "1.0", usdcPrice: "0.12", icon: <KeyRound className="w-8 h-8" /> },
  { perk: CollectiblePerk.ROLL_BOOST, name: "Roll Boost", strength: 1, tycPrice: "1.0", usdcPrice: "0.10", icon: <Sparkles className="w-8 h-8" /> },
  { perk: CollectiblePerk.PROPERTY_DISCOUNT, name: "Property Discount", strength: 1, tycPrice: "1.25", usdcPrice: "0.25", icon: <Coins className="w-8 h-8" /> },
  { perk: CollectiblePerk.SHIELD, name: "Shield", strength: 1, tycPrice: "1.5", usdcPrice: "0.40", icon: <Shield className="w-8 h-8" /> },
  { perk: CollectiblePerk.TELEPORT, name: "Teleport", strength: 1, tycPrice: "1.8", usdcPrice: "0.60", icon: <Zap className="w-8 h-8" /> },
  { perk: CollectiblePerk.ROLL_EXACT, name: "Exact Roll (Legendary)", strength: 1, tycPrice: "2.5", usdcPrice: "1.00", icon: <Sparkles className="w-8 h-8" /> },
  { perk: CollectiblePerk.CASH_TIERED, name: "Cash Tier 1", strength: 1, tycPrice: "0.5", usdcPrice: "0.05", icon: <Gem className="w-8 h-8" /> },
  { perk: CollectiblePerk.CASH_TIERED, name: "Cash Tier 2", strength: 2, tycPrice: "0.8", usdcPrice: "0.15", icon: <Gem className="w-8 h-8" /> },
  { perk: CollectiblePerk.CASH_TIERED, name: "Cash Tier 3", strength: 3, tycPrice: "1.2", usdcPrice: "0.30", icon: <Gem className="w-8 h-8" /> },
  { perk: CollectiblePerk.CASH_TIERED, name: "Cash Tier 4", strength: 4, tycPrice: "1.6", usdcPrice: "0.50", icon: <Gem className="w-8 h-8" /> },
  { perk: CollectiblePerk.CASH_TIERED, name: "Cash Tier 5", strength: 5, tycPrice: "2.0", usdcPrice: "0.90", icon: <Gem className="w-8 h-8" /> },
];
