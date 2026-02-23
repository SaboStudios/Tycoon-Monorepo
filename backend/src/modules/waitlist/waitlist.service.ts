import {
    ConflictException,
    Injectable,
    InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Waitlist } from './entities/waitlist.entity';
import { CreateWaitlistDto } from './dto/create-waitlist.dto';

@Injectable()
export class WaitlistService {
    constructor(
        @InjectRepository(Waitlist)
        private readonly waitlistRepository: Repository<Waitlist>,
    ) { }

    async create(createWaitlistDto: CreateWaitlistDto): Promise<Waitlist> {
        try {
            const entry = this.waitlistRepository.create(createWaitlistDto);
            return await this.waitlistRepository.save(entry);
        } catch (error: unknown) {
            const dbError = error as { code?: string };
            // Postgres unique violation
            if (dbError.code === '23505') {
                throw new ConflictException(
                    'Wallet address or email is already on the waitlist.',
                );
            }
            throw new InternalServerErrorException(
                'Failed to register for waitlist.',
            );
        }
    }

    async findAll(): Promise<Waitlist[]> {
        return this.waitlistRepository.find({
            order: { created_at: 'DESC' },
        });
    }
}
