import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminAnalyticsModule, AdminAnalyticsController, AdminAnalyticsService } from './index';
import { User } from '../users/entities/user.entity';
import { Game } from '../games/entities/game.entity';
import { GamePlayer } from '../games/entities/game-player.entity';

/**
 * Boot smoke test for the admin-analytics barrel (index.ts).
 *
 * index.spec.ts (added for #1973) only checks that the barrel's exports
 * resolve to defined values - it never compiles the real Nest module graph,
 * so a broken/missing import inside AdminAnalyticsModule would still only
 * fail at runtime. This test instantiates AdminAnalyticsModule via
 * Test.createTestingModule, mocking the TypeORM repositories it needs so it
 * runs without a real database connection.
 */
describe('AdminAnalyticsModule (boot smoke test, via barrel)', () => {
  it('compiles the module graph exported from the barrel', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AdminAnalyticsModule],
    })
      .overrideProvider(getRepositoryToken(User))
      .useValue({})
      .overrideProvider(getRepositoryToken(Game))
      .useValue({})
      .overrideProvider(getRepositoryToken(GamePlayer))
      .useValue({})
      .compile();

    expect(moduleRef).toBeDefined();
    expect(moduleRef.get(AdminAnalyticsController)).toBeDefined();
    expect(moduleRef.get(AdminAnalyticsService)).toBeDefined();
  });
});
