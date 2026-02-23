import { registerAs } from '@nestjs/config';

export const gameConfig = registerAs('game', () => ({
  defaultSettings: {
    auction: process.env.DEFAULT_AUCTION !== 'false',
    rentInPrison: process.env.DEFAULT_RENT_IN_PRISON === 'true',
    mortgage: process.env.DEFAULT_MORTGAGE !== 'false',
    evenBuild: process.env.DEFAULT_EVEN_BUILD !== 'false',
    randomizePlayOrder: process.env.DEFAULT_RANDOMIZE_PLAY_ORDER !== 'false',
    startingCash: parseInt(process.env.DEFAULT_STARTING_CASH || '1500', 10),
  },
}));
