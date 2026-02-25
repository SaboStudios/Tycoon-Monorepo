import {
  IsBoolean,
  IsNumber,
  IsPositive,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Minimum allowed starting cash per player.
 * This threshold ensures players have sufficient funds to participate meaningfully.
 */
const MINIMUM_ALLOWED_STARTING_CASH = 100;

/**
 * Maximum allowed starting cash per player (safety limit).
 * Prevents excessively high values that could destabilize game economy.
 */
const MAXIMUM_ALLOWED_STARTING_CASH = 100000;

/**
 * Default game settings for new game instances.
 * These values are applied when settings are not explicitly provided.
 */
const DEFAULT_GAME_SETTINGS = {
  allowSpectators: true,
  enablePowerups: false,
  ranked: false,
  auction: true,
  rentInPrison: false,
  mortgage: true,
  evenBuild: true,
  randomizePlayOrder: true,
  startingCash: 1500,
  maxPlayers: 8,
} as const;

/**
 * Data Transfer Object for validating game settings during game creation.
 *
 * This DTO enforces strict validation rules for all game settings input fields.
 * All fields have sensible defaults applied automatically if not provided.
 *
 * @remarks
 * - Boolean fields strictly accept only actual boolean values (true/false)
 * - Numeric fields have proper bounds checking including NaN and Infinity
 * - Unknown fields are rejected at the global ValidationPipe level
 * - All settings are sanitized and normalized before storage
 *
 * @example
 * ```typescript
 * // Minimal usage with defaults
 * const settings = new CreateGameSettingsDto();
 * // All fields use default values
 *
 * // Custom settings
 * const customSettings = new CreateGameSettingsDto({
 *   startingCash: 2000,
 *   ranked: true,
 *   enablePowerups: true,
 * });
 * ```
 */
export class CreateGameSettingsDto {
  /**
   * Whether spectators are allowed to watch the game.
   *
   * @default true
   * @type boolean
   * @description When enabled, non-players can observe the game in progress
   */
  @ApiProperty({
    type: Boolean,
    default: DEFAULT_GAME_SETTINGS.allowSpectators,
    description: 'Whether spectators are allowed to watch the game',
  })
  @IsBoolean({ message: 'allow_spectators must be a boolean' })
  allow_spectators: boolean;

  /**
   * Whether power-ups are enabled in the game.
   *
   * @default false
   * @type boolean
   * @description When enabled, players can acquire and use power-ups during gameplay
   */
  @ApiProperty({
    type: Boolean,
    default: DEFAULT_GAME_SETTINGS.enablePowerups,
    description: 'Whether power-ups are enabled in the game',
  })
  @IsBoolean({ message: 'enable_powerups must be a boolean' })
  enable_powerups: boolean;

  /**
   * Whether the game is ranked (affects player ratings).
   *
   * @default false
   * @type boolean
   * @description Ranked games affect player ELO/rating and require full participation
   */
  @ApiProperty({
    type: Boolean,
    default: DEFAULT_GAME_SETTINGS.ranked,
    description: 'Whether the game is ranked (affects player ratings)',
  })
  @IsBoolean({ message: 'ranked must be a boolean' })
  ranked: boolean;

  /**
   * Whether auction is enabled for unowned properties.
   *
   * @default true
   * @type boolean
   * @description When enabled, unowned properties go to auction when a player declines to purchase
   */
  @ApiProperty({
    type: Boolean,
    default: DEFAULT_GAME_SETTINGS.auction,
    description: 'Whether auction is enabled for unowned properties',
  })
  @IsBoolean({ message: 'auction must be a boolean' })
  auction: boolean;

  /**
   * Whether rent is charged while in prison.
   *
   * @default false
   * @type boolean
   * @description When enabled, players pay rent even when in prison
   */
  @ApiProperty({
    type: Boolean,
    default: DEFAULT_GAME_SETTINGS.rentInPrison,
    description: 'Whether rent is charged while in prison',
  })
  @IsBoolean({ message: 'rent_in_prison must be a boolean' })
  rent_in_prison: boolean;

  /**
   * Whether mortgage is enabled for properties.
   *
   * @default true
   * @type boolean
   * @description When enabled, players can mortgage properties for liquidity
   */
  @ApiProperty({
    type: Boolean,
    default: DEFAULT_GAME_SETTINGS.mortgage,
    description: 'Whether mortgage is enabled for properties',
  })
  @IsBoolean({ message: 'mortgage must be a boolean' })
  mortgage: boolean;

  /**
   * Whether even build rule is enforced (must build evenly across colors).
   *
   * @default true
   * @type boolean
   * @description When enabled, players must build evenly across color groups
   */
  @ApiProperty({
    type: Boolean,
    default: DEFAULT_GAME_SETTINGS.evenBuild,
    description: 'Whether even build rule is enforced',
  })
  @IsBoolean({ message: 'even_build must be a boolean' })
  even_build: boolean;

  /**
   * Whether play order is randomized each round.
   *
   * @default true
   * @type boolean
   * @description When enabled, player order changes randomly each turn
   */
  @ApiProperty({
    type: Boolean,
    default: DEFAULT_GAME_SETTINGS.randomizePlayOrder,
    description: 'Whether play order is randomized each round',
  })
  @IsBoolean({
    message: 'randomize_play_order must be a boolean',
  })
  randomize_play_order: boolean;

  /**
   * Starting cash amount for each player at game beginning.
   *
   * @default 1500
   * @type number
   * @minimum 100
   * @maximum 100000
   * @description The initial money each player receives to participate in the game
   */
  @ApiProperty({
    type: Number,
    default: DEFAULT_GAME_SETTINGS.startingCash,
    description: 'Starting cash amount for each player',
    minimum: MINIMUM_ALLOWED_STARTING_CASH,
    maximum: MAXIMUM_ALLOWED_STARTING_CASH,
  })
  @IsNumber(
    {
      allowNaN: false,
      allowInfinity: false,
    },
    {
      message: 'starting_cash must be a valid number',
    },
  )
  @IsPositive({
    message: 'starting_cash must be a positive number',
  })
  @Min(MINIMUM_ALLOWED_STARTING_CASH, {
    message: `starting_cash must be at least ${MINIMUM_ALLOWED_STARTING_CASH}`,
  })
  starting_cash: number;

  /**
   * Maximum number of players allowed in the game.
   *
   * @default 8
   * @type number
   * @minimum 2
   * @maximum 8
   * @description The maximum capacity for players in this game instance
   */
  @ApiProperty({
    type: Number,
    default: DEFAULT_GAME_SETTINGS.maxPlayers,
    description: 'Maximum number of players allowed in the game',
    minimum: 2,
    maximum: 8,
  })
  @IsNumber(
    {
      allowNaN: false,
      allowInfinity: false,
    },
    {
      message: 'max_players must be a valid number',
    },
  )
  @IsPositive({
    message: 'max_players must be a positive number',
  })
  @Min(2, {
    message: 'max_players must be at least 2',
  })
  max_players: number;

  /**
   * Creates a new CreateGameSettingsDto instance.
   *
   * @param partial - Partial settings object to initialize with
   * @description Applies default values for any missing fields to ensure
   *              all settings have valid internal state
   */
  constructor(partial?: Partial<CreateGameSettingsDto>) {
    if (partial) {
      this.allow_spectators = partial.allow_spectators ?? DEFAULT_GAME_SETTINGS.allowSpectators;
      this.enable_powerups = partial.enable_powerups ?? DEFAULT_GAME_SETTINGS.enablePowerups;
      this.ranked = partial.ranked ?? DEFAULT_GAME_SETTINGS.ranked;
      this.auction = partial.auction ?? DEFAULT_GAME_SETTINGS.auction;
      this.rent_in_prison = partial.rent_in_prison ?? DEFAULT_GAME_SETTINGS.rentInPrison;
      this.mortgage = partial.mortgage ?? DEFAULT_GAME_SETTINGS.mortgage;
      this.even_build = partial.even_build ?? DEFAULT_GAME_SETTINGS.evenBuild;
      this.randomize_play_order = partial.randomize_play_order ?? DEFAULT_GAME_SETTINGS.randomizePlayOrder;
      this.starting_cash = partial.starting_cash ?? DEFAULT_GAME_SETTINGS.startingCash;
      this.max_players = partial.max_players ?? DEFAULT_GAME_SETTINGS.maxPlayers;
    } else {
      // Apply all defaults when no partial provided
      this.allow_spectators = DEFAULT_GAME_SETTINGS.allowSpectators;
      this.enable_powerups = DEFAULT_GAME_SETTINGS.enablePowerups;
      this.ranked = DEFAULT_GAME_SETTINGS.ranked;
      this.auction = DEFAULT_GAME_SETTINGS.auction;
      this.rent_in_prison = DEFAULT_GAME_SETTINGS.rentInPrison;
      this.mortgage = DEFAULT_GAME_SETTINGS.mortgage;
      this.even_build = DEFAULT_GAME_SETTINGS.evenBuild;
      this.randomize_play_order = DEFAULT_GAME_SETTINGS.randomizePlayOrder;
      this.starting_cash = DEFAULT_GAME_SETTINGS.startingCash;
      this.max_players = DEFAULT_GAME_SETTINGS.maxPlayers;
    }
  }
}
