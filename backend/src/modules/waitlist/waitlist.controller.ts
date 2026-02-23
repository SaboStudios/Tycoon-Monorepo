import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WaitlistService } from './waitlist.service';
import { CreateWaitlistDto } from './dto/create-waitlist.dto';
import { WaitlistResponseDto } from './dto/waitlist-response.dto';
import { Waitlist } from './entities/waitlist.entity';
import {
  RedisRateLimitGuard,
  RateLimit,
} from '../../common/guards/redis-rate-limit.guard';

@ApiTags('waitlist')
@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  /**
   * POST /waitlist
   *
   * Public endpoint — no auth required.
   * Rate limited to 5 requests per minute per IP (global throttler)
   * + 10 requests per minute per IP via Redis guard.
   *
   * Validation:
   *   - At least one of wallet_address, email_address, telegram_username required
   *   - Inputs are trimmed and lowercased before persistence
   *   - Duplicate wallet/email returns 409 with a field-specific message
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(10, 60)
  @ApiOperation({
    summary: 'Join the waitlist',
    description:
      'Register interest in the product. At least one of wallet_address, email_address, or telegram_username must be provided.',
  })
  @ApiBody({ type: CreateWaitlistDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Successfully joined the waitlist.',
    type: WaitlistResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation failed — at least one contact field is required.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Wallet address or email is already registered.',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Rate limit exceeded. Try again later.',
  })
  create(
    @Body() createWaitlistDto: CreateWaitlistDto,
  ): Promise<WaitlistResponseDto> {
    return this.waitlistService.create(createWaitlistDto);
  }

  /**
   * GET /waitlist
   * Internal — returns all waitlist entries (no auth guard added here;
   * protect via API gateway or add JwtAuthGuard when needed).
   */
  @Get()
  @ApiOperation({ summary: 'Retrieve all waitlist entries (internal)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of all waitlist entries.',
    type: [Waitlist],
  })
  findAll(): Promise<Waitlist[]> {
    return this.waitlistService.findAll();
  }
}
