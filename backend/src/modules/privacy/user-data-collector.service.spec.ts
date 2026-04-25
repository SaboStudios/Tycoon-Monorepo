import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { UserPreference } from '../users/entities/user-preference.entity';
import { UserSuspension } from '../users/entities/user-suspension.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { GamePlayer } from '../games/entities/game-player.entity';
import { Purchase } from '../shop/entities/purchase.entity';
import { UserInventory } from '../shop/entities/user-inventory.entity';
import { CouponUsageLog } from '../coupons/entities/coupon-usage-log.entity';
import { UserSkin } from '../skins/entities/user-skin.entity';
import { Gift } from '../gifts/entities/gift.entity';
import { Notification } from '../fetch-notification/entities/notification.entity';
import { AuditTrail } from '../audit-trail/entities/audit-trail.entity';
import { PlayerPerk } from '../perks-boosts/entities/player-perk.entity';
import { BoostUsage } from '../perks-boosts/entities/boost-usage.entity';
import { ActiveBoost } from '../perks-boosts/entities/active-boost.entity';
import { PerkAnalyticsEvent } from '../perks-boosts/entities/perk-analytics-event.entity';
import { AdminLog } from '../admin-logs/entities/admin-log.entity';
import { Waitlist } from '../waitlist/entities/waitlist.entity';
import { UserDataCollectorService } from './user-data-collector.service';
import { USER_DATA_EXPORT_TABLE_KEYS } from './user-data-export.constants';

const userRepoMock = {
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue({
    id: 1,
    email: 'test@example.com',
    password: 'secret',
  }),
};

const emptyRepoMock = {
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
};

const entities = [
  User,
  UserPreference,
  UserSuspension,
  RefreshToken,
  GamePlayer,
  Purchase,
  UserInventory,
  CouponUsageLog,
  UserSkin,
  Gift,
  Notification,
  AuditTrail,
  PlayerPerk,
  BoostUsage,
  ActiveBoost,
  PerkAnalyticsEvent,
  AdminLog,
  Waitlist,
] as const;

describe('UserDataCollectorService', () => {
  let service: UserDataCollectorService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const providers = [
      UserDataCollectorService,
      ...entities.map((entity) => ({
        provide: getRepositoryToken(entity),
        useValue: entity === User ? userRepoMock : emptyRepoMock,
      })),
    ];

    const module: TestingModule = await Test.createTestingModule({
      providers,
    }).compile();

    service = module.get(UserDataCollectorService);
  });

  it('buildExportPayload includes only the canonical table keys', async () => {
    const payload = await service.buildExportPayload(1);
    const keys = Object.keys(payload.tables).sort();
    expect(keys).toEqual([...USER_DATA_EXPORT_TABLE_KEYS].sort());
  });
});
