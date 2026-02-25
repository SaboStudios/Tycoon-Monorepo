import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Perk } from '../entities/perk.entity';
import { ActiveBoost } from '../entities/active-boost.entity';
import { PerkType } from '../enums/perk-boost.enums';

@Injectable()
export class BoostActivationService {
    constructor(
        @InjectRepository(Perk)
        private readonly perkRepository: Repository<Perk>,
        @InjectRepository(ActiveBoost)
        private readonly activeBoostRepository: Repository<ActiveBoost>,
    ) { }

    async activatePerk(playerId: number, gameId: number, perkId: number): Promise<ActiveBoost> {
        const perk = await this.perkRepository.findOne({ where: { id: perkId } });
        if (!perk || !perk.isActive) {
            throw new BadRequestException('Perk not found or inactive');
        }

        const activeBoost = this.activeBoostRepository.create({
            user_id: playerId,
            game_id: gameId,
            perk_id: perk.id,
            activated_at: new Date(),
            is_active: true,
            is_stackable: perk.metadata?.isStackable ?? false,
        });

        // Handle duration
        if (perk.type === PerkType.TEMPORARY && perk.metadata?.durationMinutes) {
            const expiresAt = new Date();
            expiresAt.setMinutes(expiresAt.getMinutes() + perk.metadata.durationMinutes);
            activeBoost.expires_at = expiresAt;
        }

        // Handle usage limits
        if (perk.type === PerkType.CONSUMABLE) {
            activeBoost.remaining_uses = perk.metadata?.uses ?? 1;
        }

        return this.activeBoostRepository.save(activeBoost);
    }

    async deactivateBoost(boostId: number): Promise<void> {
        await this.activeBoostRepository.update(boostId, { is_active: false });
    }
}
