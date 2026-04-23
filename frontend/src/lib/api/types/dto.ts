// ─── Enums ────────────────────────────────────────────────────────────────────

export type Role = 'USER' | 'ADMIN';
export type GameMode = 'PUBLIC' | 'PRIVATE';
export type GameStatus = 'PENDING' | 'RUNNING' | 'FINISHED' | 'CANCELLED';
export type SortOrder = 'ASC' | 'DESC';
export type GamePlayerSymbol =
  | 'CAR'
  | 'DOG'
  | 'HAT'
  | 'IRON'
  | 'SHIP'
  | 'THIMBLE'
  | 'WHEELBARROW'
  | 'BOOT';

// ─── Auth DTOs ────────────────────────────────────────────────────────────────

export interface LoginDto {
  email: string;
  password: string;
}

export interface WalletLoginDto {
  address: string;
  chain: string;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface AdminLoginDto {
  email: string;
  password: string;
}

export interface AuthTokensResponse {
  access_token: string;
  refresh_token: string;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationDto {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: SortOrder;
  search?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface UserResponse {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  role: Role;
  is_admin: boolean;
  address: string | null;
  chain: string;
  games_played: number;
  game_won: number;
  game_lost: number;
  total_staked: string;
  total_earned: string;
  total_withdrawn: string;
  is_suspended: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Game Settings ────────────────────────────────────────────────────────────

export interface CreateGameSettingsDto {
  allow_spectators: boolean;
  enable_powerups: boolean;
  ranked: boolean;
  auction: boolean;
  rent_in_prison: boolean;
  mortgage: boolean;
  even_build: boolean;
  randomize_play_order: boolean;
  starting_cash: number;
  max_players: number;
}

export type UpdateGameSettingsDto = Partial<CreateGameSettingsDto>;

export interface GameSettingsResponse extends CreateGameSettingsDto {
  id: number;
  game_id: number;
}

// ─── Game DTOs ────────────────────────────────────────────────────────────────

export interface CreateGameDto {
  mode: GameMode;
  numberOfPlayers: number;
  settings?: CreateGameSettingsDto;
  is_ai?: boolean;
  is_minipay?: boolean;
  chain?: string;
  contract_game_id?: string;
}

export interface JoinGameDto {
  address?: string;
}

export interface RollDiceDto {
  dice1: number;
  dice2: number;
}

export interface BuyPropertyDto {
  propertyCost: number;
  propertyId: number;
}

export interface PayRentDto {
  payeeId: number;
  baseRent: number;
}

export interface PayTaxDto {
  amount: number;
}

export interface LockBalanceDto {
  amount: number;
}

export interface UnlockBalanceDto {
  amount: number;
}

export interface UpdateTurnDto {
  nextPlayerId: number;
}

export interface UpdateGamePlayerDto {
  position?: number;
  balance?: number;
  in_jail?: boolean;
  symbol?: GamePlayerSymbol;
}

// ─── Shop ─────────────────────────────────────────────────────────────────────

export type ShopItemType = 'dice' | 'skin' | 'symbol' | 'theme' | 'card';

export interface ShopItemResponse {
  id: number;
  name: string;
  description: string | null;
  type: ShopItemType;
  price: string;
  currency: string;
  metadata: Record<string, unknown> | null;
  rarity: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserInventoryResponse {
  id: number;
  user_id: number;
  shop_item_id: number;
  shop_item: ShopItemResponse;
  quantity: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseResponse {
  id: number;
  user_id: number;
  shop_item_id: number;
  shop_item?: ShopItemResponse;
  quantity: number;
  unit_price: string;
  total_price: string;
  original_price: string;
  discount_amount: string;
  final_price: string;
  coupon_code: string | null;
  currency: string;
  payment_method: string;
  transaction_id: string | null;
  status: string;
  is_gift: boolean;
  created_at: string;
}

// ─── Game Responses ───────────────────────────────────────────────────────────

export interface GamePlayerResponse {
  id: number;
  game_id: number;
  user_id: number;
  address: string | null;
  balance: number;
  position: number;
  turn_order: number | null;
  symbol: GamePlayerSymbol | null;
  chance_jail_card: boolean;
  community_chest_jail_card: boolean;
  in_jail: boolean;
  in_jail_rolls: number;
  rolls: number;
  circle: number;
  turn_count: number;
  consecutive_timeouts: number;
  trade_locked_balance: string;
  rolled: number | null;
  created_at: string;
  updated_at: string;
}

export interface GameResponse {
  id: number;
  code: string;
  mode: GameMode;
  creator_id: number;
  status: GameStatus;
  winner_id: number | null;
  number_of_players: number;
  next_player_id: number | null;
  is_ai: boolean;
  is_minipay: boolean;
  chain: string | null;
  duration: string | null;
  started_at: string | null;
  contract_game_id: string | null;
  placements: Record<string, number> | null;
  settings: GameSettingsResponse;
  players: GamePlayerResponse[];
  created_at: string;
  updated_at: string;
}
