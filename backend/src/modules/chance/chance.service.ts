import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chance } from './entities/chance.entity';
import { CreateChanceDto } from './dto/create-chance.dto';
import { ChanceType } from './enums/chance-type.enum';

@Injectable()
export class ChanceService {
  constructor(
    @InjectRepository(Chance)
    private readonly chanceRepository: Repository<Chance>,
  ) {}

  async createChance(createChanceDto: CreateChanceDto): Promise<Chance> {
    const trimmedInstruction = createChanceDto.instruction.trim();
    if (!trimmedInstruction || trimmedInstruction.length === 0) {
      throw new BadRequestException('Instruction cannot be empty');
    }

    if (createChanceDto.type === ChanceType.REWARD || createChanceDto.type === ChanceType.PENALTY) {
      if (createChanceDto.amount === undefined || createChanceDto.amount === null) {
        throw new BadRequestException(
          `Amount is required for ${createChanceDto.type} type chance cards`,
        );
      }
      if (createChanceDto.amount < 0) {
        throw new BadRequestException('Amount must be a non-negative number');
      }
    }

    if (createChanceDto.type === ChanceType.MOVE) {
      if (createChanceDto.position === undefined || createChanceDto.position === null) {
        throw new BadRequestException('Position is required for move type chance cards');
      }
      if (createChanceDto.position < 0) {
        throw new BadRequestException('Position must be a non-negative number');
      }
    }

    if (createChanceDto.amount !== undefined && createChanceDto.amount !== null && createChanceDto.amount < 0) {
      throw new BadRequestException('Amount must be a non-negative number');
    }

    if (createChanceDto.position !== undefined && createChanceDto.position !== null && createChanceDto.position < 0) {
      throw new BadRequestException('Position must be a non-negative number');
    }

    const chance = this.chanceRepository.create({
      instruction: trimmedInstruction,
      type: createChanceDto.type,
      amount: createChanceDto.amount ?? null,
      position: createChanceDto.position ?? null,
      extra: createChanceDto.extra ?? null,
    });

    return await this.chanceRepository.save(chance);
  }
}
