import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chance } from './entities/chance.entity';
import { CreateChanceDto } from './dto/create-chance.dto';
import { ChanceType } from './enums/chance-type.enum';
import { ListChancesQueryDto } from './dto/list-chances-query.dto';
import { PaginationService, PaginatedResponse } from '../../common';
import {
  NoChanceCardsAvailableException,
  MissingRequiredFieldException,
  InvalidChanceTypeException,
} from './exceptions/chance-exceptions';
import { RANDOM_PROVIDER } from '../../common/random-provider';
import type { RandomProvider } from '../../common/random-provider';
import { ChanceObservabilityService } from './chance-observability.service';

@Injectable()
export class ChanceService {
  constructor(
    @InjectRepository(Chance)
    private readonly chanceRepository: Repository<Chance>,
    private readonly observability: ChanceObservabilityService,
    private readonly paginationService: PaginationService,
    @Inject(RANDOM_PROVIDER)
    private readonly rng: RandomProvider,
  ) {}

  async findAll(
    queryDto: ListChancesQueryDto,
  ): Promise<PaginatedResponse<Chance>> {
    const action = 'chance.list';
    const sanitizedInput = {
      page: queryDto.page ?? 1,
      limit: queryDto.limit ?? 10,
    };
    const startedAt = Date.now();
    this.observability.logOperationStart(action, sanitizedInput);

    try {
      const qb = this.chanceRepository.createQueryBuilder('chance');
      const result = await this.paginationService.paginate(qb, queryDto, [
        'instruction',
      ], ['id', 'type', 'amount', 'position', 'createdAt', 'updatedAt']);

      this.observability.logOperationSuccess(action, Date.now() - startedAt, {
        count: result.data.length,
      });
      return result;
    } catch (err) {
      this.observability.logOperationError(action, err as Error);
      throw err;
    }
  }

  async drawCard(): Promise<Chance> {
    const action = 'chance.roll';
    const sanitizedInput = {};
    const startedAt = Date.now();
    this.observability.logOperationStart(action, sanitizedInput);

    try {
      const count = await this.chanceRepository.count();
      if (count === 0) {
        throw new BadRequestException('No chance cards available');
      }
      const randomIndex = this.rng.nextInt(count);
      const [card] = await this.chanceRepository.find({
        order: { id: 'ASC' },
        skip: randomIndex,
        take: 1,
      });

      const outcome = card.type;
      this.observability.recordRoll(outcome, Date.now() - startedAt);
      this.observability.logOperationSuccess(action, Date.now() - startedAt, {
        outcome,
        cardId: card.id,
      });
      return card;
    } catch (err) {
      this.observability.logOperationError(action, err as Error);
      throw err;
    }
  }

  async createChance(createChanceDto: CreateChanceDto): Promise<Chance> {
    const action = 'chance.create';
    const sanitizedInput = {
      type: createChanceDto.type,
      amount: createChanceDto.amount ?? null,
      position: createChanceDto.position ?? null,
    };
    const startedAt = Date.now();
    this.observability.logOperationStart(action, sanitizedInput);

    try {
      const trimmedInstruction = createChanceDto.instruction.trim();
      if (!trimmedInstruction || trimmedInstruction.length === 0) {
        throw new BadRequestException('Instruction cannot be empty');
      }

      if (
        createChanceDto.type === ChanceType.REWARD ||
        createChanceDto.type === ChanceType.PENALTY
      ) {
        if (
          createChanceDto.amount === undefined ||
          createChanceDto.amount === null
        ) {
          throw new BadRequestException(
            `Amount is required for ${createChanceDto.type} type chance cards`,
          );
        }
        if (createChanceDto.amount < 0) {
          throw new BadRequestException('Amount must be a non-negative number');
        }
      }

      if (createChanceDto.type === ChanceType.MOVE) {
        if (
          createChanceDto.position === undefined ||
          createChanceDto.position === null
        ) {
          throw new BadRequestException(
            'Position is required for move type chance cards',
          );
        }
        if (createChanceDto.position < 0) {
          throw new BadRequestException(
            'Position must be a non-negative number',
          );
        }
      }

      if (
        createChanceDto.amount !== undefined &&
        createChanceDto.amount !== null &&
        createChanceDto.amount < 0
      ) {
        throw new BadRequestException('Amount must be a non-negative number');
      }

      if (
        createChanceDto.position !== undefined &&
        createChanceDto.position !== null &&
        createChanceDto.position < 0
      ) {
        throw new BadRequestException('Position must be a non-negative number');
      }

      const chance = this.chanceRepository.create({
        instruction: trimmedInstruction,
        type: createChanceDto.type,
        amount: createChanceDto.amount ?? null,
        position: createChanceDto.position ?? null,
        extra: createChanceDto.extra ?? null,
      });

      const saved = await this.chanceRepository.save(chance);
      this.observability.logOperationSuccess(action, Date.now() - startedAt, {
        cardId: saved.id,
        type: saved.type,
      });
      return saved;
    } catch (err) {
      this.observability.logOperationError(action, err as Error);
      throw err;
    }
  }
}
