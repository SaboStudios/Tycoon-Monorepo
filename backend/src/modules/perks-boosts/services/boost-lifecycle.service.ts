import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ActiveBoost } from '../entities/active-boost.entity';
import { PerksBoostsEvents, PerkBoostEvent } from './perks-boosts-events.service';
import { PerkAnalyticsService } from './perk-analytics.service';
import { PerkEventType } from '../entities/perk-analytics-event.entity';

@Injectable()
export class BoostLifecycleService implements OnModuleInit {
    private readonly logger = new Logger(BoostLifecycleService.name);

    constructor(
        @InjectRepository(ActiveBoost)
        private readonly activeBoostRepository: Repository<ActiveBoost>,
        private readonly events: PerksBoostsEvents,
        private readonly analyticsService: PerkAnalyticsService,
        private readonly dataSource: DataSource,
    ) { }

    async onModuleInit() {
        this.logger.log('Initializing Boost Lifecycle Manager...');
        await this.checkExpiredBoosts();
    }

    @Cron(CronExpression.EVERY_MINUTE)
    async handleCron() {
        this.logger.debug('Running boost expiration check...');
        await this.checkExpiredBoosts();
    }

    /**
     * Finds and deactivates all boosts that have passed their expiration date
     */
    async checkExpiredBoosts(): Promise<void> {
        const now = new Date();

        // Find boosts about to be expired to emit events
        const expiredBoosts = await this.activeBoostRepository.find({
            where: {
                is_active: true,
                expires_at: LessThan(now),
            },
            relations: ['perk'],
        });

        if (expiredBoosts.length === 0) {
            return;
        }

        this.logger.log(`Found ${expiredBoosts.length} expired boosts. Cleanup in progress...`);

        try {
            await this.dataSource.transaction(async (manager) => {
                // Bulk update for efficiency using QueryBuilder
                await manager.createQueryBuilder()
                    .update(ActiveBoost)
                    .set({ is_active: false })
                    .where('is_active = :isActive', { isActive: true })
                    .andWhere('expires_at < :now', { now })
                    .execute();

                // Emit events for decoupled side effects (Realtime, Notifications, etc.)
                for (const boost of expiredBoosts) {
                    this.events.emit(PerkBoostEvent.BOOST_EXPIRED, {
                        playerId: boost.user_id,
                        gameId: boost.game_id,
                        metadata: {
                            boostId: boost.id,
                            perkId: boost.perk_id,
                            perkName: boost.perk?.name
                        },
                    });

                    // Log for analytics
                    await this.analyticsService.logEvent({
                        perkId: boost.perk_id,
                        userId: boost.user_id,
                        gameId: boost.game_id,
                        eventType: PerkEventType.EXPIRATION,
                        metadata: { boostId: boost.id }
                    });
                }
            });
            this.logger.log(`Successfully deactivated ${expiredBoosts.length} boosts.`);
        } catch (error) {
            this.logger.error('Failed to process expired boosts cleanup:', error);
            // We don't rethrow here to prevent cron from crashing, but it's logged
        }
    }

    /**
     * Manually expire a boost (e.g., when uses run out)
     */
    async expireBoost(boostId: number): Promise<void> {
        const boost = await this.activeBoostRepository.findOne({
            where: { id: boostId },
            relations: ['perk']
        });

        if (boost && boost.is_active) {
            boost.is_active = false;
            await this.activeBoostRepository.save(boost);

            this.events.emit(PerkBoostEvent.BOOST_EXPIRED, {
                playerId: boost.user_id,
                gameId: boost.game_id,
                metadata: {
                    boostId: boost.id,
                    perkId: boost.perk_id,
                    perkName: boost.perk?.name
                },
            });

            // Log for analytics
            await this.analyticsService.logEvent({
                perkId: boost.perk_id,
                userId: boost.user_id,
                gameId: boost.game_id,
                eventType: PerkEventType.EXPIRATION,
                metadata: { boostId: boost.id }
            });
        }
    }
}
