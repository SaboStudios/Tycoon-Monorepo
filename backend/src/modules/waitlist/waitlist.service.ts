import {
    BadRequestException,
    ConflictException,
    Injectable,
    InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Waitlist } from './entities/waitlist.entity';
import { CreateWaitlistDto } from './dto/create-waitlist.dto';
import { WaitlistResponseDto } from './dto/waitlist-response.dto';

@Injectable()
export class WaitlistService {
    constructor(
        @InjectRepository(Waitlist)
        private readonly waitlistRepository: Repository<Waitlist>,
    ) { }

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
            order: { created_at: 'DESC' },
        });
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
