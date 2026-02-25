import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Perk } from '../entities/perk.entity';

@Injectable()
export class PerkService {
    constructor(
        @InjectRepository(Perk)
        private readonly perkRepository: Repository<Perk>,
    ) { }

    async findAllActive(): Promise<Perk[]> {
        return this.perkRepository.find({ where: { isActive: true } });
    }

    async findOne(id: number): Promise<Perk> {
        const perk = await this.perkRepository.findOne({ where: { id } });
        if (!perk) {
            throw new NotFoundException(`Perk with ID ${id} not found`);
        }
        return perk;
    }

    async create(data: Partial<Perk>): Promise<Perk> {
        const perk = this.perkRepository.create(data);
        return this.perkRepository.save(perk);
    }
}
