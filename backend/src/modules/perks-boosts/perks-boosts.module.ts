import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Perk } from './entities/perk.entity';
import { ActiveBoost } from './entities/active-boost.entity';
import { BoostUsage } from './entities/boost-usage.entity';
import { PlayerPerk } from './entities/player-perk.entity';
import { PerkService } from './services/perk.service';
import { BoostService } from './services/boost.service';
import { BoostActivationService } from './services/boost-activation.service';
import { InventoryService } from './services/inventory.service';
import { PerksBoostsEvents } from './services/perks-boosts-events.service';
import { FeatureToggleService } from './services/feature-toggle.service';
import { PerkBoostListener } from './services/perk-boost-listener.service';
import { BoostLifecycleService } from './services/boost-lifecycle.service';
import { PerkBoostGateway } from './gateways/perk-boost.gateway';
import { PerksController } from './perks-boosts.controller';
import { PerksAnalyticsController } from './perks-analytics.controller';
import { NotificationsModule } from '../fetch-notification/notifications.module';
import { PerkAnalyticsEvent } from './entities/perk-analytics-event.entity';
import { PerkAnalyticsService } from './services/perk-analytics.service';
import { Game } from '../games/entities/game.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Perk, ActiveBoost, BoostUsage, PlayerPerk, PerkAnalyticsEvent, Game]),
        NotificationsModule,
    ],
    controllers: [PerksController, PerksAnalyticsController],
    providers: [
        PerkService,
        BoostService,
        BoostActivationService,
        InventoryService,
        PerksBoostsEvents,
        FeatureToggleService,
        PerkBoostListener,
        BoostLifecycleService,
        PerkBoostGateway,
        PerkAnalyticsService,
    ],
    exports: [
        PerkService,
        BoostService,
        BoostActivationService,
        InventoryService,
        PerksBoostsEvents,
        FeatureToggleService,
        BoostLifecycleService,
        PerkAnalyticsService,
    ],
})
export class PerksBoostsModule { }
