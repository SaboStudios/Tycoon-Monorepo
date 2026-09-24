/**
 * User Profile and Gameplay Statistics DTO
 * Contains aggregated statistics for authenticated users
 * No sensitive data (passwords, addresses, etc.) is exposed
 */
export class UserProfileDto {
  username: string;

  games_played: number;

  game_won: number;

  game_lost: number;

  total_staked: string;

  total_earned: string;

  total_withdrawn: string;

  is_admin: boolean;
}
