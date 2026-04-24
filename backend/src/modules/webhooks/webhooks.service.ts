import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { RedisService } from '../redis/redis.service';
import { WebhookEvent } from './entities/webhook-event.entity';
import { PaginationDto, SortOrder } from '../../common/dto/pagination.dto';
import { PaginatedResponse } from '../../common/interfaces/paginated-response.interface';

const ALLOWED_SORT_FIELDS = new Set(['id', 'eventType', 'source', 'createdAt']);

@Injectable()
export class WebhooksService {
  private readonly webhookSecret: string;
  private readonly toleranceSeconds = 300; // 5 minutes

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    @InjectRepository(WebhookEvent)
    private readonly webhookEventRepo: Repository<WebhookEvent>,
  ) {
    this.webhookSecret =
      this.configService.get<string>('WEBHOOK_SECRET') ||
      'default_secret_change_me';
  }

  /**
   * Verify HMAC signature of a webhook request
   */
  verifySignature(
    signature: string,
    timestamp: string,
    rawBody: Buffer,
  ): boolean {
    if (!signature || !timestamp || !rawBody) {
      throw new UnauthorizedException('Missing webhook signature or timestamp');
    }

    // Anti-replay protection: Check timestamp tolerance
    const now = Math.floor(Date.now() / 1000);
    const ts = parseInt(timestamp, 10);
    if (isNaN(ts) || Math.abs(now - ts) > this.toleranceSeconds) {
      throw new UnauthorizedException('Webhook timestamp outside of tolerance');
    }

    // Construct the payload for verification (standard pattern: timestamp + '.' + body)
    const signedPayload = `${timestamp}.${rawBody.toString()}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(signedPayload)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    try {
      const signatureBuffer = Buffer.from(signature, 'hex');
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');

      if (signatureBuffer.length !== expectedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
    } catch (ignore) {
      return false;
    }
  }

  async processWebhook(payload: any) {
    // Idempotency check: Use the webhook ID to prevent duplicate processing
    const webhookId = payload.id;
    if (!webhookId) {
      throw new UnauthorizedException('Webhook payload missing ID for idempotency');
    }

    const idempotencyKey = `webhook:${webhookId}`;
    const isProcessed = await this.redisService.get<boolean>(idempotencyKey);

    if (isProcessed) {
      return { received: true, idempotent: true };
    }

    // Mark as processed (TTL of 7 days to handle potential retries)
    await this.redisService.set(idempotencyKey, true, 604800);

    // Persist the event for audit / listing
    await this.webhookEventRepo.save(
      this.webhookEventRepo.create({
        eventId: webhookId,
        eventType: payload.type ?? 'unknown',
        source: 'stripe',
        payload,
      }),
    );

    return { received: true, processed: true };
  }

  /**
   * List webhook events with pagination and stable sorting.
   * Stable sort is guaranteed by always appending `id ASC` as a tiebreaker.
   */
  async listEvents(
    dto: PaginationDto,
  ): Promise<PaginatedResponse<WebhookEvent>> {
    const {
      page = 1,
      limit = 10,
      sortBy,
      sortOrder = SortOrder.ASC,
    } = dto;

    const safeSortBy =
      sortBy && ALLOWED_SORT_FIELDS.has(sortBy) ? sortBy : 'createdAt';

    const qb = this.webhookEventRepo
      .createQueryBuilder('we')
      .orderBy(`we.${safeSortBy}`, sortOrder)
      // Stable tiebreaker: always secondary-sort by id ASC
      .addOrderBy('we.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, totalItems] = await qb.getManyAndCount();
    const totalPages = Math.ceil(totalItems / limit);

    return {
      data,
      meta: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }
}
