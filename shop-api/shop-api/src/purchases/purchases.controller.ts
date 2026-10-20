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
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { IdempotencyKeyGuard } from '../common/guards/idempotency-key.guard';

/**
 * POST /purchases
 *
 * Requires the `Idempotency-Key` header (UUID recommended, max 255 chars).
 *
 * Clients MUST send the same key when retrying a failed or timed-out request.
 * The server returns the identical response body and status code for any
 * subsequent request carrying an already-completed key — no side effects.
 *
 * Error responses:
 *   400 – Missing or invalid Idempotency-Key header
 *   409 – A request with this key is currently being processed (retry later)
 *   201 – Purchase created (or replayed from cache)
 */
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(IdempotencyKeyGuard)
  async create(
    @Body() dto: CreatePurchaseDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    return this.purchasesService.create(dto, idempotencyKey);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const purchase = await this.purchasesService.findOne(id);
    if (!purchase) throw new NotFoundException(`Purchase ${id} not found`);
    return purchase;
  }
}
