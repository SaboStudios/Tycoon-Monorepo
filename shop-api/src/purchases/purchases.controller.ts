import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { IdempotencyKeyGuard } from '../common/guards/idempotency-key.guard';
import { ApiKeyAuthGuard } from '../common/guards/api-key.guard';
import { Purchase } from './entities/purchase.entity';

/**
 * POST /purchases
 *
 * Requires authentication via `x-api-key` header or a Bearer JWT, plus the
 * `Idempotency-Key` header (UUID recommended, max 255 chars).
 *
 * Clients MUST send the same key when retrying a failed or timed-out request.
 * The server returns the identical response body and status code for any
 * subsequent request carrying an already-completed key — no side effects.
 *
 * Error responses:
 *   400 – Missing or invalid Idempotency-Key header
 *   401 – Missing or invalid authentication (API key or JWT)
 *   409 – A request with this key is currently being processed (retry later)
 *   201 – Purchase created (or replayed from cache)
 */
@ApiTags('purchases')
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a purchase (idempotent)',
    description:
      'Authenticated via `x-api-key` header or a Bearer JWT. ' +
      'Requires the `Idempotency-Key` header — retries with the same key ' +
      'return the identical cached response (replay) with no side effects. ' +
      'A 409 means the key is currently being processed; retry after a short delay.',
  })
  @ApiBearerAuth()
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID recommended, max 255 chars. Same key on retries enables replay protection.',
  })
  @ApiHeader({
    name: 'x-api-key',
    required: false,
    description: 'API key — alternative to a Bearer JWT.',
  })
  @ApiResponse({
    status: 201,
    description: 'Purchase created (or replayed from cache — identical body).',
    type: Purchase,
  })
  @ApiResponse({
    status: 400,
    description: 'Missing/invalid Idempotency-Key header, or invalid body.',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid authentication (API key or JWT).',
  })
  @ApiResponse({
    status: 409,
    description: 'Idempotency key is currently being processed — retry later.',
  })
  @UseGuards(ApiKeyAuthGuard, IdempotencyKeyGuard)
  async create(
    @Body() dto: CreatePurchaseDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    return this.purchasesService.create(dto, idempotencyKey);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve a single purchase by ID' })
  @ApiResponse({ status: 200, description: 'The purchase.', type: Purchase })
  @ApiResponse({ status: 404, description: 'Purchase not found.' })
  async findOne(@Param('id') id: string) {
    const purchase = await this.purchasesService.findOne(id);
    if (!purchase) throw new NotFoundException(`Purchase ${id} not found`);
    return purchase;
  }
}
