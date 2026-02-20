// export interface Player {
//   id: number;
//   user_id: number;
//   game_id: number;
//   address: string;
//   symbol: string;
//   balance: number;
//   position: number;
//   turn_order: number;
//   chance_jail_card: boolean;
//   community_chest_jail_card: boolean;
//   created_at?: string;
//   updated_at?: string;
// }

// export interface Game {
//   id: number;
//   code: string;
//   mode: string;
//   creator_id: number;
//   next_player_id: number;
//   number_of_players: number;
//   status: "PENDING" | "RUNNING" | "FINISHED" | "CANCELLED";
//   created_at?: string;
//   updated_at?: string;
// }

import { Player, Game } from "./game";

export interface GameSettings {
  auction: boolean;
  rent_in_prison: boolean;
  mortgage: boolean;
  even_build: boolean;
  starting_cash: number;
  randomize_play_order: boolean;
}

export interface GameCreatedData {
  game: Game & {
    settings: GameSettings;
    players: Player[];
  };
}

export interface PlayerJoinedData {
  player: Player;
  players: Player[];
  game: Game;
}

export interface PlayerLeftData {
  player: Player;
  players: Player[];
  game: Game;
}

export interface PositionChangedData {
  player: Player;
  gameId: number;
}

export interface GameReadyData {
  game: Game;
  players: Player[];
}

export interface GameStartedData {
  game: Game;
}

export interface GameEndedData {
  gameCode: string;
}
