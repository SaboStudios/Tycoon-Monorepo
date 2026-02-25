import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ActiveBoost } from '../entities/active-boost.entity';
import { PerksBoostsEvents, PerkBoostEvent } from './perks-boosts-events.service';

@Injectable()
export class BoostLifecycleService implements OnModuleInit {
    private readonly logger = new Logger(BoostLifecycleService.name);

    constructor(
        @InjectRepository(ActiveBoost)
        private readonly activeBoostRepository: Repository<ActiveBoost>,
        private readonly events: PerksBoostsEvents,
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
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const expiredBoosts = await queryRunner.manager.find(ActiveBoost, {
                where: {
                    is_active: true,
                    expires_at: LessThan(new Date()),
                },
            });

            if (expiredBoosts.length > 0) {
                this.logger.log(`Found ${expiredBoosts.length} expired boosts. Deactivating...`);

                for (const boost of expiredBoosts) {
                    boost.is_active = false;
                    await queryRunner.manager.save(boost);

                    // Emit expiration event
                    this.events.emit(PerkBoostEvent.BOOST_EXPIRED, {
                        playerId: boost.user_id,
                        gameId: boost.game_id,
                        metadata: { boostId: boost.id, perkId: boost.perk_id },
                    });
                }
            }

            await queryRunner.commitTransaction();
        } catch (error) {
            this.logger.error('Error during boost expiration check:', error);
            await queryRunner.rollbackTransaction();
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Manually expire a boost (e.g., when uses run out)
     */
    async expireBoost(boostId: number): Promise<void> {
        const boost = await this.activeBoostRepository.findOne({ where: { id: boostId } });
        if (boost && boost.is_active) {
            boost.is_active = false;
            await this.activeBoostRepository.save(boost);

            this.events.emit(PerkBoostEvent.BOOST_EXPIRED, {
                playerId: boost.user_id,
                gameId: boost.game_id,
                metadata: { boostId: boost.id, perkId: boost.perk_id },
            });
        }
    }
}
