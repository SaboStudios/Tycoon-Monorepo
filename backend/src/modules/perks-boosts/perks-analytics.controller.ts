import { Controller, Get, Res } from '@nestjs/common';
import { PerkAnalyticsService } from './services/perk-analytics.service';
import type { Response } from 'express';

@Controller('perks/analytics')
export class PerksAnalyticsController {
    constructor(private readonly analyticsService: PerkAnalyticsService) { }

    @Get('dashboard')
    async getDashboard() {
        return this.analyticsService.getAnalyticsDashboard();
    }

    @Get('export')
    async exportReport(@Res() res: Response) {
        const report = await this.analyticsService.exportReport();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=perk-analytics-report.json');
        return res.send(report);
    }

    @Get('most-used')
    async getMostUsed() {
        return this.analyticsService.getMostUsedPerks();
    }

    @Get('revenue')
    async getRevenue() {
        return this.analyticsService.getRevenuePerPerk();
    }

    @Get('win-rate')
    async getWinRate() {
        return this.analyticsService.getWinRateImpact();
    }
}
