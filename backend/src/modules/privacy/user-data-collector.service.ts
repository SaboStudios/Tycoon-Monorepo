import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
import {
  USER_DATA_EXPORT_TABLE_KEYS,
  USER_DATA_EXPORT_VERSION,
} from './user-data-export.constants';

export type UserDataExportPayload = {
  export_version: string;
  generated_at: string;
  user_id: number;
  tables: Record<string, unknown>;
};

@Injectable()
export class UserDataCollectorService {
  private readonly logger = new Logger(UserDataCollectorService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserPreference)
    private readonly userPreferences: Repository<UserPreference>,
    @InjectRepository(UserSuspension)
    private readonly userSuspensions: Repository<UserSuspension>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    @InjectRepository(GamePlayer) private readonly gamePlayers: Repository<GamePlayer>,
    @InjectRepository(Purchase) private readonly purchases: Repository<Purchase>,
    @InjectRepository(UserInventory)
    private readonly userInventory: Repository<UserInventory>,
    @InjectRepository(CouponUsageLog)
    private readonly couponUsageLogs: Repository<CouponUsageLog>,
    @InjectRepository(UserSkin) private readonly userSkins: Repository<UserSkin>,
    @InjectRepository(Gift) private readonly gifts: Repository<Gift>,
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    @InjectRepository(AuditTrail) private readonly auditTrails: Repository<AuditTrail>,
    @InjectRepository(PlayerPerk) private readonly playerPerks: Repository<PlayerPerk>,
    @InjectRepository(BoostUsage) private readonly boostUsage: Repository<BoostUsage>,
    @InjectRepository(ActiveBoost) private readonly activeBoosts: Repository<ActiveBoost>,
    @InjectRepository(PerkAnalyticsEvent)
    private readonly perkAnalytics: Repository<PerkAnalyticsEvent>,
    @InjectRepository(AdminLog) private readonly adminLogs: Repository<AdminLog>,
    @InjectRepository(Waitlist) private readonly waitlist: Repository<Waitlist>,
  ) {}

  /** Builds the export payload; keys under `tables` match `USER_DATA_EXPORT_TABLE_KEYS`. */
  async buildExportPayload(userId: number): Promise<UserDataExportPayload> {
    const tables: Record<string, unknown> = {};

    const safe = async (key: string, fn: () => Promise<unknown>) => {
      try {
        tables[key] = await fn();
      } catch (err) {
        this.logger.warn(`Export slice "${key}" failed: ${(err as Error).message}`);
        tables[key] = { _error: 'collection_failed', _message: (err as Error).message };
      }
    };

    await safe('users', async () => {
      const row = await this.users.findOne({ where: { id: userId } });
      if (!row) return null;
      const plain = { ...row } as Record<string, unknown>;
      delete plain.password;
      return plain;
    });

    await safe('user_preferences', () =>
      this.userPreferences.find({ where: { user_id: userId } }),
    );
    await safe('user_suspensions', () =>
      this.userSuspensions.find({ where: { userId } }),
    );
    await safe('refresh_tokens', async () => {
      const rows = await this.refreshTokens.find({ where: { userId } });
      return rows.map((r) => ({
        id: r.id,
        token: '[REDACTED]',
        userId: r.userId,
        expiresAt: r.expiresAt,
        isRevoked: r.isRevoked,
        createdAt: r.createdAt,
      }));
    });
    await safe('game_players', () =>
      this.gamePlayers.find({ where: { user_id: userId } }),
    );
    await safe('purchases', () =>
      this.purchases.find({ where: { user_id: userId } }),
    );
    await safe('user_inventory', () =>
      this.userInventory.find({ where: { user_id: userId } }),
    );
    await safe('coupon_usage_logs', () =>
      this.couponUsageLogs.find({ where: { user_id: userId } }),
    );
    await safe('user_skins', () =>
      this.userSkins.find({ where: { user_id: userId } }),
    );
    await safe('gifts', () =>
      this.gifts.find({
        where: [{ sender_id: userId }, { receiver_id: userId }],
      }),
    );
    await safe('notifications', () =>
      this.notifications.find({ where: { userId: String(userId) } }),
    );
    await safe('audit_trails', () =>
      this.auditTrails.find({ where: { userId } }),
    );
    await safe('player_perks', () =>
      this.playerPerks.find({ where: { user_id: userId } }),
    );
    await safe('boost_usage_tracking', () =>
      this.boostUsage.find({ where: { user_id: userId } }),
    );
    await safe('active_boosts', () =>
      this.activeBoosts.find({ where: { user_id: userId } }),
    );
    await safe('perk_analytics_events', () =>
      this.perkAnalytics.find({ where: { user_id: userId } }),
    );
    await safe('admin_logs', () =>
      this.adminLogs.find({ where: { adminId: userId } }),
    );

    await safe('waitlist_match_by_email', async () => {
      const u = await this.users.findOne({
        where: { id: userId },
        select: ['id', 'email'],
      });
      if (!u?.email) return [];
      return this.waitlist.find({
        where: { email_address: u.email },
        withDeleted: true,
      });
    });

    const keys = Object.keys(tables).sort();
    const expected = [...USER_DATA_EXPORT_TABLE_KEYS].sort();
    if (keys.join(',') !== expected.join(',')) {
      this.logger.error(
        `Export table keys mismatch. Got: ${keys.join(',')}. Expected: ${expected.join(',')}`,
      );
    }

    return {
      export_version: USER_DATA_EXPORT_VERSION,
      generated_at: new Date().toISOString(),
      user_id: userId,
      tables,
    };
  }
}
