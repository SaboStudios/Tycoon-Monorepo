import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import * as crypto from 'crypto';

@Injectable()
export class WebhooksService {
  private readonly webhookSecret: string;
  private readonly toleranceSeconds = 300; // 5 minutes

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
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
      // Webhook already processed, return success without reprocessing
      return { received: true, idempotent: true };
    }

    // Mark as processed (TTL of 7 days to handle potential retries)
    await this.redisService.set(idempotencyKey, true, 604800);

    // Logic to process the validated webhook payload
    // This could trigger jobs, update database, etc.
    console.log('Processing webhook payload:', payload);

    // Simulate processing
    // In real implementation, this would handle different event types
    return Promise.resolve({ received: true, processed: true });
  }
}
