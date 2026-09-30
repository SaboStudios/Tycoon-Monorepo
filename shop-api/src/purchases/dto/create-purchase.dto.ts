import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  MaxLength,
  Matches,
  IsOptional,
  IsIn,
} from "class-validator";
import { Type, Transform } from "class-transformer";

/**
 * CreatePurchaseDto — authoritative purchase write payload for shop-api.
 *
 * Per ADR-001 §7, ADR-003 purchase-write contract, and SHOP_PURCHASES_RUNBOOK:
 *  - `shop-api` is the source of truth for money, inventory, and purchases.
 *  - Prices are server-derived from the catalog; no client-trusted `price` or
 *    `amount` float is accepted. Money is conveyed in **integer minor units**
 *    (e.g. cents) so floating-point rounding cannot create or destroy value.
 *  - `sku` is the catalog SKU (non-empty, bounded, pattern-constrained).
 *  - `quantity` is an integer in [1, SHOP_PURCHASE_MAX_QUANTITY] (default 100).
 *  - `amountMinor` is the amount in minor units (integer, >=0, bounded) and
 *    must match the server-derived catalog price for the SKU×quantity. The
 *    integer check rejects floats, NaN, Infinity, and decimal strings.
 *  - Unknown fields are rejected (`whitelist: true, forbidNonWhitelisted: true`
 *    in main.ts). Any client-supplied `price`, `amount` (float), or `itemId`
 *    is therefore a 400 rather than a silently ignored field.
 *  - Oversized payloads are rejected at the Nest body-parser/validation layer;
 *    DTO length caps (MaxLength) provide a second bound.
 *
 * Money bounds — why these limits:
 *  - `quantity` cap (100) bounds blast radius of a single request and keeps
 *    inventory decrement serialisation tractable under concurrent checkout.
 *  - `amountMinor` cap (10_000_000 = $100,000.00 in cents) prevents integer
 *    overflow on `amountMinor * quantity` in downstream ledgers and guards
 *    against adversarial large-value writes. The lower bound 0 allows $0 / gift
 *    purchases; negative values are rejected.
 *  - `sku` MaxLength 64 + pattern prevents enumeration payloads and oversized
 *    keys while allowing typical SKU forms (`sku_gold_pack_100`, `ITEM-42`,
 *    `bundle:starter.1`).
 *
 * Backward compatibility:
 *  - Legacy `itemId` / `amount` (float major units) are intentionally NOT
 *    accepted. Clients must send `sku` + `quantity` + `amountMinor`. A request
 *    carrying `itemId` or `amount` receives 400 with `errors` per
 *    docs/API_ERROR_RESPONSE_STANDARDS.md so the caller can correct the shape.
 *
 * Security / observability:
 *  - No secrets, tokens, or PII are echoed in validation messages.
 *  - `requestId` (`x-request-id`) is propagated by RequestIdMiddleware and
 *    echoed in error responses via HttpExceptionFilter; logs include requestId
 *    without the sensitive payload.
 */

const SKU_PATTERN = /^[A-Za-z0-9_\-:.]+$/;
const MAX_SKU_LENGTH = 64;
const MAX_QUANTITY = 100;
const MIN_MINOR_UNITS = 0;
const MAX_MINOR_UNITS = 10_000_000; // $100k in cents
const MAX_USER_ID_LENGTH = 64;

export class CreatePurchaseDto {
  @ApiProperty({
    description:
      "Authenticated user ID (opaque string, trimmed, 1-64 chars). Resolved server-side from auth; must match the authenticated subject when both are present.",
    example: "usr_8821",
    maxLength: MAX_USER_ID_LENGTH,
  })
  @IsString()
  @IsNotEmpty({ message: "userId must be a non-empty string" })
  @MaxLength(MAX_USER_ID_LENGTH, {
    message: `userId must be ${MAX_USER_ID_LENGTH} characters or fewer`,
  })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  userId: string;

  @ApiProperty({
    description:
      "Catalog SKU of the item being purchased. Must match an existing catalog SKU; unknown SKUs return the same 400 shape as other validation failures (no enumeration leakage).",
    example: "sku_gold_pack_100",
    maxLength: MAX_SKU_LENGTH,
    pattern: String(SKU_PATTERN),
  })
  @IsString()
  @IsNotEmpty({ message: "sku must be a non-empty string" })
  @MaxLength(MAX_SKU_LENGTH, {
    message: `sku must be ${MAX_SKU_LENGTH} characters or fewer`,
  })
  @Matches(SKU_PATTERN, {
    message:
      "sku may contain only letters, numbers, underscore, hyphen, colon, and dot",
  })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  sku: string;

  @ApiProperty({
    description: "Quantity to purchase (integer).",
    example: 1,
    minimum: 1,
    maximum: MAX_QUANTITY,
  })
  @Type(() => Number)
  @IsInt({ message: "quantity must be an integer" })
  @Min(1, { message: "quantity must be at least 1" })
  @Max(MAX_QUANTITY, {
    message: `quantity must be ${MAX_QUANTITY} or fewer`,
  })
  quantity: number;

  @ApiProperty({
    description:
      "Amount in minor units (integer cents). Server-derived catalog price is authoritative; this value is validated for bounds and must equal sku unit price × quantity. Rejects floats, NaN, and Infinity.",
    example: 4999,
    minimum: MIN_MINOR_UNITS,
    maximum: MAX_MINOR_UNITS,
  })
  @Type(() => Number)
  @IsInt({
    message: "amountMinor must be an integer (minor units, e.g. cents)",
  })
  @Min(MIN_MINOR_UNITS, {
    message: `amountMinor must be ${MIN_MINOR_UNITS} or greater`,
  })
  @Max(MAX_MINOR_UNITS, {
    message: `amountMinor must be ${MAX_MINOR_UNITS} or fewer`,
  })
  amountMinor: number;

  @ApiPropertyOptional({
    description:
      "Currency code (ISO 4217). Only USD is supported today; any other value is rejected. When omitted the server assumes USD.",
    example: "USD",
    default: "USD",
    maxLength: 10,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  @IsIn(["USD"], { message: "currency must be USD" })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  currency?: string;
}
