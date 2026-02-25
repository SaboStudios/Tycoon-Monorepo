import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PerkAnalyticsEvent, PerkEventType } from '../entities/perk-analytics-event.entity';
import { ActiveBoost } from '../entities/active-boost.entity';
import { Perk } from '../entities/perk.entity';
import { Game } from '../../games/entities/game.entity';

@Injectable()
export class PerkAnalyticsService {
    private readonly logger = new Logger(PerkAnalyticsService.name);

    constructor(
        @InjectRepository(PerkAnalyticsEvent)
        private readonly analyticsRepository: Repository<PerkAnalyticsEvent>,
        @InjectRepository(ActiveBoost)
        private readonly activeBoostRepository: Repository<ActiveBoost>,
        @InjectRepository(Game)
        private readonly gameRepository: Repository<Game>,
        private readonly dataSource: DataSource,
    ) { }

    async logEvent(data: {
        perkId: number;
        userId: number;
        gameId?: number;
        eventType: PerkEventType;
        revenue?: number;
        metadata?: any;
    }): Promise<void> {
        try {
            const event = this.analyticsRepository.create({
                perk_id: data.perkId,
                user_id: data.userId,
                game_id: data.gameId,
                event_type: data.eventType,
                revenue: data.revenue || 0,
                metadata: data.metadata,
            });
            await this.analyticsRepository.save(event);
            this.logger.log(`Logged perk event: ${data.eventType} for perk ${data.perkId}`);
        } catch (error) {
            this.logger.error(`Failed to log perk event: ${error.message}`, error.stack);
        }
    }

    async getMostUsedPerks(limit: number = 10): Promise<any[]> {
        return this.analyticsRepository.createQueryBuilder('ae')
            .select('ae.perk_id', 'perkId')
            .addSelect('p.name', 'name')
            .addSelect('COUNT(*)', 'usageCount')
            .innerJoin('perks', 'p', 'p.id = ae.perk_id')
            .where('ae.event_type = :type', { type: PerkEventType.ACTIVATION })
            .groupBy('ae.perk_id')
            .addGroupBy('p.name')
            .orderBy('usageCount', 'DESC')
            .limit(limit)
            .getRawMany();
    }

    async getRevenuePerPerk(): Promise<any[]> {
        return this.analyticsRepository.createQueryBuilder('ae')
            .select('ae.perk_id', 'perkId')
            .addSelect('p.name', 'name')
            .addSelect('SUM(ae.revenue)', 'totalRevenue')
            .innerJoin('perks', 'p', 'p.id = ae.perk_id')
            .where('ae.event_type = :type', { type: PerkEventType.PURCHASE })
            .groupBy('ae.perk_id')
            .addGroupBy('p.name')
            .orderBy('totalRevenue', 'DESC')
            .getRawMany();
    }

    async getWinRateImpact(): Promise<any[]> {
        // This is a more complex query. We want to compare win rates of players with perks vs without.
        // For simplicity, let's just get the win rate for each perk when it was active.

        return this.dataSource.query(`
            SELECT 
                p.id as "perkId",
                p.name as "name",
                COUNT(DISTINCT ae.game_id) as "totalGames",
                COUNT(DISTINCT CASE WHEN g.winner_id = ae.user_id THEN ae.game_id END) as "wins",
                (COUNT(DISTINCT CASE WHEN g.winner_id = ae.user_id THEN ae.game_id END)::float / 
                 NULLIF(COUNT(DISTINCT ae.game_id), 0)) * 100 as "winRate"
            FROM perk_analytics_events ae
            INNER JOIN perks p ON p.id = ae.perk_id
            INNER JOIN games g ON g.id = ae.game_id
            WHERE ae.event_type = 'activation'
            AND g.status = 'FINISHED'
            GROUP BY p.id, p.name
            ORDER BY "winRate" DESC
        `);
    }

    async getAnalyticsDashboard(): Promise<any> {
        const [mostUsed, revenue, winRate] = await Promise.all([
            this.getMostUsedPerks(),
            this.getRevenuePerPerk(),
            this.getWinRateImpact()
        ]);

        return {
            mostUsedPerks: mostUsed,
            revenuePerPerk: revenue,
            winRateImpact: winRate
        };
    }

    async exportReport(): Promise<string> {
        const data = await this.getAnalyticsDashboard();
        // Simple JSON export for now, could be CSV
        return JSON.stringify(data, null, 2);
    }
}
