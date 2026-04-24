import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { RedisService } from '../redis/redis.service';
import { WebhookEvent } from './entities/webhook-event.entity';
import { PaginationDto, SortOrder } from '../../common/dto/pagination.dto';
import { PaginatedResponse } from '../../common/interfaces/paginated-response.interface';
import { WebhooksObservabilityService } from './webhooks-observability.service';

const ALLOWED_SORT_FIELDS = new Set(['id', 'eventType', 'source', 'createdAt']);

@Injectable()
export class WebhooksService {
  private readonly webhookSecret: string;
  private readonly toleranceSeconds = 300; // 5 minutes

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly observability: WebhooksObservabilityService,
    @InjectRepository(WebhookEvent)
    private readonly webhookEventRepo: Repository<WebhookEvent>,
  ) {
    this.webhookSecret =
      this.configService.get<string>('WEBHOOK_SECRET') ||
      'default_secret_change_me';
  }

  /**
   * Verify HMAC signature of a webhook request
   * Includes observability: logs and metrics for verification attempts
   */
  verifySignature(
    signature: string,
    timestamp: string,
    rawBody: Buffer,
    source = 'stripe',
  ): boolean {
    const startTime = Date.now();
    let failureReason: string | undefined;

    try {
      if (!signature || !timestamp || !rawBody) {
        failureReason = 'missing_signature_or_timestamp';
        this.observability.logSignatureVerification(
          source,
          false,
          Date.now() - startTime,
          failureReason,
        );
        throw new UnauthorizedException('Missing webhook signature or timestamp');
      }

      // Anti-replay protection: Check timestamp tolerance
      const now = Math.floor(Date.now() / 1000);
      const ts = parseInt(timestamp, 10);
      if (isNaN(ts) || Math.abs(now - ts) > this.toleranceSeconds) {
        failureReason = 'timestamp_outside_tolerance';
        this.observability.logSignatureVerification(
          source,
          false,
          Date.now() - startTime,
          failureReason,
        );
        throw new UnauthorizedException('Webhook timestamp outside of tolerance');
      }

      // Construct the payload for verification (standard pattern: timestamp + '.' + body)
      const signedPayload = `${timestamp}.${rawBody.toString()}`;
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(signedPayload)
        .digest('hex');

      // Constant-time comparison to prevent timing attacks
      let isValid = false;
      try {
        const signatureBuffer = Buffer.from(signature, 'hex');
        const expectedBuffer = Buffer.from(expectedSignature, 'hex');

        if (signatureBuffer.length !== expectedBuffer.length) {
          failureReason = 'signature_length_mismatch';
          isValid = false;
        } else {
          isValid = crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
          if (!isValid) {
            failureReason = 'signature_mismatch';
          }
        }
      } catch (error) {
        failureReason = 'signature_format_error';
        isValid = false;
      }

      // Log verification result
      this.observability.logSignatureVerification(
        source,
        isValid,
        Date.now() - startTime,
        failureReason,
      );

      return isValid;
    } catch (error) {
      // If we haven't logged yet, log the failure
      if (!failureReason) {
        this.observability.logSignatureVerification(
          source,
          false,
          Date.now() - startTime,
          'unexpected_error',
        );
      }
      throw error;
    }
  }

  async processWebhook(payload: any, source = 'stripe') {
    const startTime = Date.now();
    const webhookId = payload.id;
    const eventType = payload.type ?? 'unknown';

    // Log webhook received
    this.observability.logWebhookReceived({
      webhookId,
      eventType,
      source,
    });

    try {
      // Idempotency check: Use the webhook ID to prevent duplicate processing
      if (!webhookId) {
        throw new UnauthorizedException('Webhook payload missing ID for idempotency');
      }

      const idempotencyKey = `webhook:${webhookId}`;
      const isProcessed = await this.redisService.get<boolean>(idempotencyKey);

      if (isProcessed) {
        // Log idempotency hit
        this.observability.logIdempotencyHit({
          webhookId,
          eventType,
          source,
        });
        return { received: true, idempotent: true };
      }

      // Mark as processed (TTL of 7 days to handle potential retries)
      await this.redisService.set(idempotencyKey, true, 604800);

      // Persist the event for audit / listing
      await this.webhookEventRepo.save(
        this.webhookEventRepo.create({
          eventId: webhookId,
          eventType,
          source,
          payload,
        }),
      );

      // Log successful processing
      this.observability.logWebhookProcessed(
        {
          webhookId,
          eventType,
          source,
        },
        Date.now() - startTime,
      );

      return { received: true, processed: true };
    } catch (error) {
      // Log processing failure
      this.observability.logWebhookProcessingFailed(
        {
          webhookId,
          eventType,
          source,
        },
        error as Error,
        Date.now() - startTime,
      );
      throw error;
    }
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
