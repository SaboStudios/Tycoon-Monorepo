import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { JobsModule } from '../jobs/jobs.module';
import { AuthModule } from '../auth/auth.module';
import { UserDataExportJob } from './entities/user-data-export-job.entity';
import { UserDataCollectorService } from './user-data-collector.service';
import { UserDataExportService } from './user-data-export.service';
import { UserDataExportProcessor } from './user-data-export.processor';
import { UserMeDataExportController } from './user-me-data-export.controller';
import { DataExportDownloadController } from './data-export-download.controller';

@Module({
  imports: [
    JobsModule,
    AuthModule,
    BullModule.registerQueue({ name: 'user-data' }),
    TypeOrmModule.forFeature([
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
      UserDataExportJob,
    ]),
  ],
  controllers: [UserMeDataExportController, DataExportDownloadController],
  providers: [
    UserDataCollectorService,
    UserDataExportService,
    UserDataExportProcessor,
  ],
  exports: [UserDataExportService],
})
export class PrivacyModule {}
