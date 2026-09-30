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
  Req,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Request } from "express";
import { PurchasesService } from "./purchases.service";
import { CreatePurchaseDto } from "./dto/create-purchase.dto";
import { IdempotencyKeyGuard } from "../common/guards/idempotency-key.guard";
import { ApiKeyAuthGuard } from "../common/guards/api-key.guard";
import { Purchase } from "./entities/purchase.entity";

/**
 * POST /purchases
 *
 * Authoritative write path for purchases (ADR-001). Every mutation is
 * executed by shop-api; backend is read-only/proxy and must forward the
 * caller's Idempotency-Key and requestId unchanged, never trust client
 * price, and fail closed when shop-api is unavailable.
 *
 * Requires authentication via `x-api-key` header or a Bearer JWT, plus the
 * `Idempotency-Key` header (UUID recommended, max 255 chars). The DTO
 * validates `sku`, `quantity`, and `amountMinor` (integer minor units) with
 * strict bounds and rejects unknown fields per policy (`forbidNonWhitelisted`).
 *
 * Idempotency semantics:
 *  - Same key + same body hash → replay stored 201 response (no side effects).
 *  - Same key + different body hash → 409 IDEMPOTENCY_CONFLICT.
 *  - In-flight duplicate → 409 (retry after short delay).
 *  - After TTL (default 86400s / 7 days) the key expires and may be reused.
 *
 * Inventory:
 *  - Decremented atomically inside the same transaction as the purchase
 *    (conditional UPDATE WHERE available >= quantity) so concurrent checkouts
 *    of the same SKU cannot oversell; inventory never goes negative (CHECK).
 *
 * Observability:
 *  - `requestId` (`x-request-id`) is propagated end-to-end and echoed in
 *    success/error responses; RED metrics emitted for purchase.
 *  - Errors mapped to docs/API_ERROR_RESPONSE_STANDARDS.md canonical shape
 *    `{ statusCode, message, errors, correlationId }`.
 *
 * Security:
 *  - API-key only for service calls; no client-trusted price.
 *  - Admin catalog mutations audited.
 *  - Rate-limited per class `purchase` (see SHOP_PURCHASES_RUNBOOK.md).
 *
 * Error responses:
 *   400 – Missing or invalid Idempotency-Key header, or invalid DTO (sku/quantity/amountMinor bounds, unknown fields)
 *   401 – Missing or invalid authentication (API key or JWT)
 *   409 – Payload conflict (different body with same key), in-flight duplicate, or INSUFFICIENT_INVENTORY
 *   503 – Dependency unavailable (DB/Redis/shop-api) — fail closed on writes
 *   201 – Purchase created (or replayed from cache)
 */
@ApiTags("purchases")
@Controller("purchases")
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Create a purchase (idempotent)",
    description:
      "Authenticated via `x-api-key` header or a Bearer JWT. " +
      "Requires the `Idempotency-Key` header — retries with the same key " +
      "return the identical cached response (replay) with no side effects. " +
      "A 409 means the key is currently being processed or conflicts with a prior payload; retry after a short delay. " +
      "DTO validates sku (non-empty, 1-64, pattern), quantity (1-100 int), amountMinor (0-10_000_000 int minor units), and rejects client-trusted price/unknown fields. " +
      "Inventory is decremented atomically; concurrent buys of the same SKU serialize and never oversell.",
  })
  @ApiBearerAuth()
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    description:
      "UUID recommended, max 255 chars. Same key on retries enables replay protection.",
  })
  @ApiHeader({
    name: "x-api-key",
    required: false,
    description: "API key — alternative to a Bearer JWT.",
  })
  @ApiHeader({
    name: "x-request-id",
    required: false,
    description: "Correlation ID propagated end-to-end; echoed in response.",
  })
  @ApiResponse({
    status: 201,
    description: "Purchase created (or replayed from cache — identical body).",
    type: Purchase,
  })
  @ApiResponse({
    status: 400,
    description:
      "Missing/invalid Idempotency-Key header, or invalid body (sku/quantity/amountMinor bounds, unknown fields).",
  })
  @ApiResponse({
    status: 401,
    description: "Missing or invalid authentication (API key or JWT).",
  })
  @ApiResponse({
    status: 409,
    description:
      "Idempotency key conflict (payload mismatch / in-flight) or insufficient inventory.",
  })
  @UseGuards(ApiKeyAuthGuard, IdempotencyKeyGuard)
  async create(
    @Body() dto: CreatePurchaseDto,
    @Headers("idempotency-key") idempotencyKey: string,
    @Req() req: Request,
  ) {
    const requestId =
      (req.headers["x-request-id"] as string) ||
      (req as any).requestId ||
      undefined;
    return this.purchasesService.create(dto, idempotencyKey, requestId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Retrieve a single purchase by ID" })
  @ApiResponse({ status: 200, description: "The purchase.", type: Purchase })
  @ApiResponse({ status: 404, description: "Purchase not found." })
  async findOne(@Param("id") id: string) {
    const purchase = await this.purchasesService.findOne(id);
    if (!purchase) throw new NotFoundException(`Purchase ${id} not found`);
    return purchase;
  }
}
