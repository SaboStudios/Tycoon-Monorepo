import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { PerkService } from './services/perk.service';
import { BoostActivationService } from './services/boost-activation.service';
import { Perk } from './entities/perk.entity';
import { ActiveBoost } from './entities/active-boost.entity';

@Controller('perks')
export class PerksController {
    constructor(
        private readonly perkService: PerkService,
        private readonly boostActivationService: BoostActivationService,
    ) { }

    @Get()
    async findAll(): Promise<Perk[]> {
        return this.perkService.findAllActive();
    }

    @Post('activate')
    async activate(
        @Body() body: { playerId: number; gameId: number; perkId: number }
    ): Promise<ActiveBoost> {
        return this.boostActivationService.activatePerk(body.playerId, body.gameId, body.perkId);
    }

    @Post()
    async create(@Body() data: Partial<Perk>): Promise<Perk> {
        return this.perkService.create(data);
    }
}
