export interface GameContextProps {
  isAppearanceModalOpen: boolean;
  setAppearanceModalOpen: (isOpen: boolean) => void;
  players: Player[];
  setPlayers: (players: Player[]) => void;
  selectedColor: string;
  setSelectedColor: (color: string) => void;
}

export interface BoardDataSquare {
  id: number;
  type:
    | "corner"
    | "property"
    | "luxury_tax"
    | "income_tax"
    | "chance"
    | "community_chest";
  name: string;
  price: number;
  rent_site_only: number;
  rent_one_house: number;
  rent_two_houses: number;
  rent_three_houses: number;
  rent_four_houses: number;
  rent_hotel: number;
  cost_of_house: number;
  is_mortgaged: boolean;
  group_id: number;
  color: string;
  position: "top" | "bottom" | "left" | "right";
  grid_row: number;
  grid_col: number;
  icon: string;
}

export type Position = "bottom" | "left" | "top" | "right";
export interface Game {
  id: number;
  code: string;
  mode: "PUBLIC" | "PRIVATE";
  creator_id: number;
  status: "WAITING" | "RUNNING" | "FINISHED" | "CANCELLED";
  winner_id: number | null;
  number_of_players: number;
  next_player_id: number | null;
  duration: number | string | null;
  created_at: string;
  updated_at: string;
  /** Set when status becomes RUNNING (e.g. all players joined). Game timing starts from this. */
  started_at?: string | null;
  is_ai?: boolean;
  /** When game ends by time: { user_id: position } where 1 = winner. */
  placements?: Record<number, number>;
  settings: GameSettings;
  players: Player[];
  history: History[];
}

export interface GameSettings {
  auction: number;
  mortgage: number;
  even_build: number;
  randomize_play_order: number;
  starting_cash: number;
}

export interface Player {
  id?: number; // game_player id (for chat)
  user_id: number;
  address: string;
  chance_jail_card: number;
  community_chest_jail_card: number;
  balance: number;
  position: number;
  turn_order: number | null;
  symbol: string;
  joined_date: string;
  username: string;
  rolls: number;
  /** Dice total for current turn (2–12); set after player rolls, reset on end turn */
  rolled?: number | null;
  circle: number;
  in_jail: boolean;
  in_jail_rolls: number;
  /** Unix timestamp (seconds) when current turn started; used for 90s roll timer */
  turn_start?: string | null;
  /** Consecutive 90s turn timeouts; after 3, opponents can remove this player (multiplayer) */
  consecutive_timeouts?: number;
  /** Number of turns this player has completed (for anti-spam: valid wins require >= 20 turns) */
  turn_count?: number;
}

export interface GamePlayExtra {
  description: string;
  [key: string]: any;
}
export interface History {
  id: number;
  game_id: number;
  game_player_id: number;
  rolled: number | null;
  old_position: number | null;
  new_position: number;
  action: string;
  amount: number;
  extra: GamePlayExtra | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
  active: boolean | number;
  player_symbol: string;
  player_name: string;
}

export interface Property {
  id: number;
  type: string;
  name: string;
  group_id: number;
  position: Position;
  grid_row: number;
  grid_col: number;
  price: number;
  rent_site_only: number;
  rent_one_house: number;
  rent_two_houses: number;
  rent_three_houses: number;
  rent_four_houses: number;
  rent_hotel: number;
  cost_of_house: number;
  is_mortgaged: boolean;
  color: string;
  icon?: string | null;
}

export interface GameProperty {
  id: number;
  game_id: number;
  address: string;
  player_id: number;
  property_id: number;
  mortgaged: boolean;
  development: number;
  created_at: string | null;
  updated_at: string | null;
}

export type OwnedProperty = GameProperty & Property;

export const PROPERTY_POSITION = [
  1, 3, 6, 8, 9, 11, 13, 14, 16, 18, 19, 21, 23, 24, 26, 27, 29, 31, 32, 34, 37,
  39,
];

export const NO_PROPERTY_POSITION = [
  0, 2, 4, 5, 7, 10, 12, 15, 17, 20, 22, 25, 28, 30, 33, 35, 36,
];

export const RAILWAY_POSITION = [5, 15, 25, 35];

export const UTILITY_POSITION = [12, 28];

export const COMMUNITY_CHEST_POSITION = [2, 17, 33];

export const CHANCE_POSITION = [7, 22, 36];

export const GOTO_JAIL_POSITION = [30];

export const VISITING_JAIL_POSITION = [10];

export const START_POSITION = [0];

export const FREE_PACKING_POSITION = [20];

export const INCOME_TAX_POSITION = [4];

export const LUXURY_TAX_POSITION = [38];

export const CardTypesArray = [
  "land",
  "railway",
  "utility",
  "community_chest",
  "chance",
  "goto_jail",
  "visiting_jail",
  "start",
  "free_packing",
  "income_tax",
  "luxury_tax",
];

export type CardTypes =
  | "land"
  | "railway"
  | "utility"
  | "community_chest"
  | "chance"
  | "goto_jail"
  | "visiting_jail"
  | "start"
  | "free_packing"
  | "income_tax"
  | "luxury_tax";

export const POSITION_MAP: Record<CardTypes, number[]> = {
  land: PROPERTY_POSITION,
  railway: RAILWAY_POSITION,
  utility: UTILITY_POSITION,
  community_chest: COMMUNITY_CHEST_POSITION,
  chance: CHANCE_POSITION,
  goto_jail: GOTO_JAIL_POSITION,
  visiting_jail: VISITING_JAIL_POSITION,
  start: START_POSITION,
  free_packing: FREE_PACKING_POSITION,
  income_tax: INCOME_TAX_POSITION,
  luxury_tax: LUXURY_TAX_POSITION,
};

export const PROPERTY_ACTION = (position: number): CardTypes | null => {
  for (const [type, positions] of Object.entries(POSITION_MAP) as [
    CardTypes,
    number[]
  ][]) {
    if (positions.includes(position)) return type;
  }
  return null;
};
