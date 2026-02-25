import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Perk } from './entities/perk.entity';
import { ActiveBoost } from './entities/active-boost.entity';
import { BoostUsage } from './entities/boost-usage.entity';
import { PerkService } from './services/perk.service';
import { BoostService } from './services/boost.service';
import { BoostActivationService } from './services/boost-activation.service';
import { PerksBoostsEvents } from './services/perks-boosts-events.service';
import { FeatureToggleService } from './services/feature-toggle.service';
import { PerkBoostListener } from './services/perk-boost-listener.service';
import { PerksController } from './perks-boosts.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([Perk, ActiveBoost, BoostUsage]),
    ],
    controllers: [PerksController],
    providers: [
        PerkService,
        BoostService,
        BoostActivationService,
        PerksBoostsEvents,
        FeatureToggleService,
        PerkBoostListener,
    ],
    exports: [
        PerkService,
        BoostService,
        BoostActivationService,
        PerksBoostsEvents,
        FeatureToggleService,
    ],
})
export class PerksBoostsModule { }
