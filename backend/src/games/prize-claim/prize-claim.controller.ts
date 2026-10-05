import { BadRequestException, Controller, Headers, HttpCode, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';                // ⬇ only if the repo uses it; else its rate-limit mechanism
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';    // ⬇ your real guard path
import { PrizeClaimService } from './prize-claim.service';

const KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;

@Controller('games')
export class PrizeClaimController {
  constructor(private readonly service: PrizeClaimService) {}

  @Post(':id/prize-claim')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  claim(
    @Param('id', ParseIntPipe) gameId: number,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: { user: { id: number } },                    // ⬇ match how your guard attaches the user
  ) {
    if (!key || !KEY_RE.test(key)) {
      throw new BadRequestException({ code: 'INVALID_IDEMPOTENCY_KEY' });
    }
    return this.service.claim(gameId, req.user.id, key);
  }
}