import { registerAs } from '@nestjs/config';

/**
 * Parse an integer environment variable, falling back to a default when the
 * value is unset or not a valid number. `parseInt` alone silently yields `NaN`
 * for non-numeric input (e.g. `DEFAULT_STARTING_CASH=abc`), which would then
 * propagate into game creation.
 */
export function parseIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const gameConfig = registerAs('game', () => ({
  defaultSettings: {
    auction: process.env.DEFAULT_AUCTION !== 'false',
    rentInPrison: process.env.DEFAULT_RENT_IN_PRISON === 'true',
    mortgage: process.env.DEFAULT_MORTGAGE !== 'false',
    evenBuild: process.env.DEFAULT_EVEN_BUILD !== 'false',
    randomizePlayOrder: process.env.DEFAULT_RANDOMIZE_PLAY_ORDER !== 'false',
    startingCash: parseIntEnv('DEFAULT_STARTING_CASH', 1500),
  },
  chatEnabled: process.env.GAMES_CHAT_ENABLED === 'true',
}));
