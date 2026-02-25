import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PlayerPerk } from '../entities/player-perk.entity';
import { Perk } from '../entities/perk.entity';
import { PerkType } from '../enums/perk-boost.enums';

@Injectable()
export class InventoryService {
    constructor(
        @InjectRepository(PlayerPerk)
        private readonly playerPerkRepository: Repository<PlayerPerk>,
        @InjectRepository(Perk)
        private readonly perkRepository: Repository<Perk>,
        private readonly dataSource: DataSource,
    ) { }

    async getPlayerInventory(userId: number): Promise<PlayerPerk[]> {
        return this.playerPerkRepository.find({
            where: { user_id: userId },
            relations: ['perk'],
            order: { acquired_at: 'DESC' },
        });
    }

    async addPerksToInventory(userId: number, perks: { perkId: number; quantity: number }[]): Promise<void> {
        await this.dataSource.transaction(async (manager) => {
            for (const item of perks) {
                const perk = await manager.findOne(Perk, { where: { id: item.perkId } });
                if (!perk) {
                    throw new NotFoundException(`Perk with ID ${item.perkId} not found`);
                }

                let playerPerk = await manager.findOne(PlayerPerk, {
                    where: { user_id: userId, perk_id: item.perkId },
                    lock: { mode: 'pessimistic_write' },
                });

                if (playerPerk) {
                    playerPerk.quantity += item.quantity;
                    await manager.save(playerPerk);
                } else {
                    playerPerk = manager.create(PlayerPerk, {
                        user_id: userId,
                        perk_id: item.perkId,
                        quantity: item.quantity,
                    });
                    await manager.save(playerPerk);
                }
            }
        });
    }

    async validateOwnership(userId: number, perkId: number): Promise<PlayerPerk> {
        const playerPerk = await this.playerPerkRepository.findOne({
            where: { user_id: userId, perk_id: perkId },
            relations: ['perk'],
        });

        if (!playerPerk || playerPerk.quantity <= 0) {
            throw new BadRequestException('Player does not own this perk');
        }

        return playerPerk;
    }

    async equipPerk(userId: number, perkId: number): Promise<PlayerPerk> {
        const playerPerk = await this.validateOwnership(userId, perkId);
        playerPerk.is_equipped = true;
        return this.playerPerkRepository.save(playerPerk);
    }

    async unequipPerk(userId: number, perkId: number): Promise<PlayerPerk> {
        const playerPerk = await this.validateOwnership(userId, perkId);
        playerPerk.is_equipped = false;
        return this.playerPerkRepository.save(playerPerk);
    }

    async consumePerk(userId: number, perkId: number): Promise<void> {
        await this.dataSource.transaction(async (manager) => {
            const playerPerk = await manager.findOne(PlayerPerk, {
                where: { user_id: userId, perk_id: perkId },
                relations: ['perk'],
                lock: { mode: 'pessimistic_write' },
            });

            if (!playerPerk || playerPerk.quantity <= 0) {
                throw new BadRequestException('Player does not own this perk or it is out of stock');
            }

            if (playerPerk.perk.type === PerkType.CONSUMABLE) {
                playerPerk.quantity -= 1;
                await manager.save(playerPerk);
            } else if (playerPerk.perk.type === PerkType.TEMPORARY || playerPerk.perk.type === PerkType.PERMANENT) {
                // Non-consumables might just be "used" to activate a boost without decreasing quantity
                // But the requirement says "Consume perks", so we handle quantity for consumables specifically.
            }
        });
    }
}
