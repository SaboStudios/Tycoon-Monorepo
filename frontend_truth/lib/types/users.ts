export interface User {
  id?: number;
  username?: string;
  address?: string;
  chain?: string;
  games_played?: number;
  game_won?: number;
  game_lost?: number;
  total_staked?: string;
  total_earned?: string;
  total_withdrawn?: string;
  created_at?: string;
  updated_at?: string;
}
