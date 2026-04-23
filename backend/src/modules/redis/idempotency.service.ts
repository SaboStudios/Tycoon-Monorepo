import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

export interface IdempotencyRecord {
  status: 'processing' | 'complete';
  response?: unknown;
  createdAt: number;
}

const DEFAULT_TTL = 86_400; // 24 h

@Injectable()
export class IdempotencyService {
  constructor(private readonly redis: RedisService) {}

  private key(idempotencyKey: string): string {
    return `idempotency:${idempotencyKey}`;
  }

  async get(idempotencyKey: string): Promise<IdempotencyRecord | undefined> {
    return this.redis.get<IdempotencyRecord>(this.key(idempotencyKey));
  }

  async markProcessing(idempotencyKey: string, ttl = DEFAULT_TTL): Promise<void> {
    const record: IdempotencyRecord = { status: 'processing', createdAt: Date.now() };
    await this.redis.set(this.key(idempotencyKey), record, ttl * 1000);
  }

  async markComplete(
    idempotencyKey: string,
    response: unknown,
    ttl = DEFAULT_TTL,
  ): Promise<void> {
    const record: IdempotencyRecord = {
      status: 'complete',
      response,
      createdAt: Date.now(),
    };
    await this.redis.set(this.key(idempotencyKey), record, ttl * 1000);
  }

  async delete(idempotencyKey: string): Promise<void> {
    await this.redis.del(this.key(idempotencyKey));
  }
}
