import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, IsNull, LessThanOrEqual } from 'typeorm';
import { ActiveBoost } from '../entities/active-boost.entity';
import { BoostUsage } from '../entities/boost-usage.entity';
import { IBoostContext } from '../interfaces/boost-strategy.interface';
import { BoostType, StackingRule } from '../enums/perk-boost.enums';
import { MultiplierStrategy } from '../strategies/multiplier.strategy';
import { FlatAddStrategy } from '../strategies/flat-add.strategy';
import { FeatureToggleService } from './feature-toggle.service';

@Injectable()
export class BoostService {
    constructor(
        @InjectRepository(ActiveBoost)
        private readonly activeBoostRepository: Repository<ActiveBoost>,
        @InjectRepository(BoostUsage)
        private readonly boostUsageRepository: Repository<BoostUsage>,
        private readonly featureToggleService: FeatureToggleService,
    ) { }

    async getActiveBoostsForPlayer(playerId: number, gameId: number, type?: BoostType): Promise<ActiveBoost[]> {
        const now = new Date();
        const query = this.activeBoostRepository.createQueryBuilder('ab')
            .leftJoinAndSelect('ab.perk', 'perk')
            .where('ab.user_id = :playerId', { playerId })
            .andWhere('ab.game_id = :gameId', { gameId })
            .andWhere('ab.is_active = true')
            .andWhere('(ab.expires_at IS NULL OR ab.expires_at > :now)', { now })
            .andWhere('(ab.remaining_uses IS NULL OR ab.remaining_uses > 0)');

        if (type) {
            query.andWhere('perk.metadata->>\'boostType\' = :type', { type });
        }

        return query.getMany();
    }

    async calculateModifiedValue(
        context: IBoostContext,
        type: BoostType,
    ): Promise<number> {
        const activeBoosts = await this.getActiveBoostsForPlayer(context.playerId, context.gameId, type);

        let result = context.baseValue;

        // Group boosts by stacking rule
        const additives = activeBoosts.filter(b => b.perk.metadata?.stackingRule === StackingRule.ADDITIVE);
        const multiplicatives = activeBoosts.filter(b => b.perk.metadata?.stackingRule === StackingRule.MULTIPLICATIVE);
        const highestOnly = activeBoosts.filter(b => b.perk.metadata?.stackingRule === StackingRule.HIGHEST_ONLY);

        // Apply additives first
        for (const boost of additives) {
            const strategy = new FlatAddStrategy(type, boost.perk.metadata.value);
            result = strategy.apply(context, result);
            await this.trackUsage(boost, context);
        }

        // Apply multiplicatives
        for (const boost of multiplicatives) {
            const strategy = new MultiplierStrategy(type, boost.perk.metadata.value);
            result = strategy.apply(context, result);
            await this.trackUsage(boost, context);
        }

        // Apply highest only
        if (highestOnly.length > 0) {
            const bestBoost = highestOnly.reduce((prev, current) =>
                (current.perk.metadata.value > prev.perk.metadata.value) ? current : prev
            );
            const strategy = new MultiplierStrategy(type, bestBoost.perk.metadata.value);
            result = strategy.apply(context, result);
            await this.trackUsage(bestBoost, context);
        }

        return result;
    }

    private async trackUsage(boost: ActiveBoost, context: IBoostContext): Promise<void> {
        // Only track and decrement if it's a consumable
        if (boost.remaining_uses > 0) {
            boost.remaining_uses -= 1;
            if (boost.remaining_uses === 0) {
                boost.is_active = false;
            }
            await this.activeBoostRepository.save(boost);
        }

        const usage = this.boostUsageRepository.create({
            active_boost_id: boost.id,
            game_id: context.gameId,
            user_id: context.playerId,
            event_data: context.metadata,
        });
        await this.boostUsageRepository.save(usage);
    }
}
