export interface Game {
  id: number;
  code: string;
  mode: "PUBLIC" | "PRIVATE";
  creator_id: number;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "CANCELLED";
  winner_id: null | number;
  number_of_players: number;
  next_player_id: number;
  created_at: string;
  updated_at: string;
  /** Set when status becomes RUNNING (e.g. all players joined). Game timing starts from this. */
  started_at?: string | null;
  settings: GameSetting;
  players: Array<GamePlayer>;
}

export interface GameSetting {
  auction: boolean;
  mortgage: boolean;
  even_build: boolean;
  randomize_play_order: boolean;
  starting_cash: number;
}

export interface GamePlayer {
  user_id: number;
  address: string;
  chance_jail_card: boolean;
  community_chest_jail_card: boolean;
  balance: number;
  position: number;
  turn_order: number;
  symbol: string;
  joined_date: string;
  username: string;
}
