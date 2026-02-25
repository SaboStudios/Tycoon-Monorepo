import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Perk } from '../entities/perk.entity';
import { ActiveBoost } from '../entities/active-boost.entity';
import { PerkType } from '../enums/perk-boost.enums';
import { InventoryService } from './inventory.service';

@Injectable()
export class BoostActivationService {
    constructor(
        @InjectRepository(Perk)
        private readonly perkRepository: Repository<Perk>,
        @InjectRepository(ActiveBoost)
        private readonly activeBoostRepository: Repository<ActiveBoost>,
        private readonly inventoryService: InventoryService,
        private readonly dataSource: DataSource,
    ) { }

    async activatePerk(playerId: number, gameId: number, perkId: number): Promise<ActiveBoost> {
        return await this.dataSource.transaction(async (manager) => {
            // 1. Validate ownership and get perk info
            const playerPerk = await this.inventoryService.validateOwnership(playerId, perkId);
            const perk = playerPerk.perk;

            if (!perk || !perk.isActive) {
                throw new BadRequestException('Perk not found or inactive');
            }

            // 2. Consume perk if it's consumable
            if (perk.type === PerkType.CONSUMABLE) {
                await this.inventoryService.consumePerk(playerId, perkId);
            }

            // 3. Create active boost
            const activeBoost = manager.create(ActiveBoost, {
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

            return manager.save(activeBoost);
        });
    }

    async deactivateBoost(boostId: number): Promise<void> {
        await this.activeBoostRepository.update(boostId, { is_active: false });
    }
}
