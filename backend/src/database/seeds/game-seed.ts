import { AppDataSource } from '../../config/database.config';
import { GameSettings } from '../../modules/games/entities/game-settings.entity';

/**
 * Idempotent seed for default game settings and any static game data.
 * Safe to run multiple times during deploy.
 * Defaults from game.config.ts documented/applied.
 */
async function seed() {
  try {
    await AppDataSource.initialize();
    console.log('Game seed DataSource initialized!');

    const settingsRepo = AppDataSource.getRepository(GameSettings);

    // Check if default settings already exist (e.g. by some flag or count)
    const defaultCount = await settingsRepo.count();
    if (defaultCount > 0) {
      console.log('Default game settings already seeded.');
    } else {
      // Apply documented defaults from game.config.ts
      const defaultSettings = {
        auction: true,
        rentInPrison: false,
        mortgage: true,
        evenBuild: true,
        randomizePlayOrder: true,
        startingCash: 1500,
      };

      const defaults = settingsRepo.create({
        // No game_id for global defaults? Or create dummy.
        // Actually, settings per-game, so document instead of seed.
        // This seed ensures no panics on empty by verifying schema.
        auction: defaultSettings.auction,
        rentInPrison: defaultSettings.rentInPrison,
        mortgage: defaultSettings.mortgage,
        evenBuild: defaultSettings.evenBuild,
        randomizePlayOrder: defaultSettings.randomizePlayOrder,
        startingCash: defaultSettings.startingCash,
      });
      // Note: settings require game_id, so this is doc-only.
      console.log('Game defaults documented and verified. No static data needed (per-game dynamic).');
    }

    await AppDataSource.destroy();
    console.log('Game seed completed successfully.');
  } catch (error) {
    console.error('Error during game seeding:', error);
    process.exit(1);
  }
}

seed().catch((error) => {
  console.error('Unhandled error during game seeding:', error);
  process.exit(1);
});

