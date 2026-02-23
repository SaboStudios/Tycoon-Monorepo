import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { Waitlist } from './entities/waitlist.entity';
import { CreateWaitlistDto } from './dto/create-waitlist.dto';
import { WaitlistResponseDto } from './dto/waitlist-response.dto';
import { WaitlistPaginationDto } from './dto/waitlist-pagination.dto';
import { PaginationService, PaginatedResponse, SortOrder } from '../../common';

@Injectable()
export class WaitlistService {
  constructor(
    @InjectRepository(Waitlist)
    private readonly waitlistRepository: Repository<Waitlist>,
    private readonly paginationService: PaginationService,
  ) {}

  /**
   * Register a new waitlist entry.
   * Validates at least one identifier is provided, checks per-field
   * uniqueness with precise error messages, then persists the entry.
   */
  async create(dto: CreateWaitlistDto): Promise<WaitlistResponseDto> {
    const { wallet_address, email_address, telegram_username } = dto;

    // Service-level guard (belt-and-suspenders after DTO validation)
    if (!wallet_address && !email_address && !telegram_username) {
      throw new BadRequestException(
        'At least one of wallet_address, email_address, or telegram_username is required.',
      );
    }

    // Per-field duplicate checks — gives specific, user-friendly error messages
    if (wallet_address) {
      const existing = await this.waitlistRepository.findOne({
        where: { wallet_address },
      });
      if (existing) {
        throw new ConflictException(
          'This wallet address is already on the waitlist.',
        );
      }
    }

    if (email_address) {
      const existing = await this.waitlistRepository.findOne({
        where: { email_address },
      });
      if (existing) {
        throw new ConflictException(
          'This email address is already on the waitlist.',
        );
      }
    }

    try {
      const entry = this.waitlistRepository.create(dto);
      const saved = await this.waitlistRepository.save(entry);
      return this.toResponseDto(saved);
    } catch (error: unknown) {
      const dbError = error as { code?: string };
      // Fallback: catch any remaining unique constraint violations
      if (dbError.code === '23505') {
        throw new ConflictException(
          'This entry is already registered on the waitlist.',
        );
      }
      throw new InternalServerErrorException(
        'Failed to register for the waitlist. Please try again.',
      );
    }
  }

  async findAll(): Promise<Waitlist[]> {
    return this.waitlistRepository.find({
      order: { created_at: SortOrder.DESC },
    });
  }

  /**
   * Get all waitlist entries with pagination, sorting and filtering for admin.
   */
  async findAllAdmin(
    paginationDto: WaitlistPaginationDto,
  ): Promise<PaginatedResponse<Waitlist>> {
    const { wallet, email, telegram, sortBy, sortOrder } = paginationDto;

    const queryBuilder = this.waitlistRepository.createQueryBuilder('waitlist');

    // Apply filters
    if (wallet) {
      queryBuilder.andWhere('waitlist.wallet_address ILIKE :wallet', {
        wallet: `%${wallet}%`,
      });
    }
    if (email) {
      queryBuilder.andWhere('waitlist.email_address ILIKE :email', {
        email: `%${email}%`,
      });
    }
    if (telegram) {
      queryBuilder.andWhere('waitlist.telegram_username ILIKE :telegram', {
        telegram: `%${telegram}%`,
      });
    }
  }

    // Apply specific sorting logic if requested
    if (sortBy === 'newest') {
      queryBuilder.orderBy('waitlist.created_at', sortOrder || SortOrder.DESC);
    } else if (sortBy === 'wallet') {
      queryBuilder.orderBy(
        'waitlist.wallet_address',
        sortOrder || SortOrder.ASC,
      );
    } else if (sortBy === 'email') {
      queryBuilder.orderBy(
        'waitlist.email_address',
        sortOrder || SortOrder.ASC,
      );
    } else if (sortBy) {
      // Default to entity field sorting if it's a valid field
      queryBuilder.orderBy(`waitlist.${sortBy}`, sortOrder || SortOrder.ASC);
    } else {
      // Default sort
      queryBuilder.orderBy('waitlist.created_at', SortOrder.DESC);
    }

    return await this.paginationService.paginate(queryBuilder, paginationDto);
  }

  /**
   * Get aggregate statistics for the waitlist.
   */
  async getStats() {
    const total = await this.waitlistRepository.count();
    const withWallet = await this.waitlistRepository.count({
      where: { wallet_address: Not(IsNull()) },
    });
    const withEmail = await this.waitlistRepository.count({
      where: { email_address: Not(IsNull()) },
    });

    return {
      totalItems: total,
      withWallet,
      withEmail,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private toResponseDto(entry: Waitlist): WaitlistResponseDto {
    return {
      message: 'You have been added to the waitlist.',
      data: {
        wallet_address: entry.wallet_address ?? null,
        email_address: entry.email_address ?? null,
        telegram_username: entry.telegram_username ?? null,
        joined_at: entry.created_at,
      },
    };
  }
}
