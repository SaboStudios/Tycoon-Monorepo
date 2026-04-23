import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { createHash } from 'crypto';
import { IdempotencyOptions, IDEMPOTENCY_HEADER, DEFAULT_IDEMPOTENCY_TTL, IDEMPOTENCY_KEY_PREFIX } from './idempotency.constants';
import { Request, Response } from 'express';

export interface IdempotencyRecord {
  key: string;
  response?: {
    statusCode: number;
    headers: Record<string, string>;
    body?: any;
  };
  timestamp: number;
  ttl: number;
  requestHash?: string;
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly redis: Redis;

  constructor(private readonly configService: ConfigService) {
    // Initialize Redis connection for idempotency storage
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });

    this.redis.on('error', (err) => {
      this.logger.error('Redis connection error for idempotency', err);
    });
  }

  /**
   * Generate a unique idempotency key for a request
   */
  generateKey(req: Request, options: IdempotencyOptions = {}): string {
    // Check if client provided an idempotency key
    const clientKey = req.headers[IDEMPOTENCY_HEADER.toLowerCase()] as string;
    if (clientKey) {
      return `${IDEMPOTENCY_KEY_PREFIX}${clientKey}`;
    }

    // Generate server-side key
    const keyParts = [
      req.method,
      req.path,
      req.ip,
    ];

    // Include query parameters if specified
    if (options.includeQuery !== false && Object.keys(req.query).length > 0) {
      keyParts.push(JSON.stringify(req.query));
    }

    // Include selected headers if specified
    if (options.includeHeaders && options.headersToInclude) {
      const headers = options.headersToInclude
        .map(header => `${header}:${req.headers[header.toLowerCase()]}`)
        .join('|');
      if (headers) {
        keyParts.push(headers);
      }
    }

    // Include request body if specified
    if (options.includeBody && req.body) {
      keyParts.push(JSON.stringify(req.body));
    }

    // Create hash from key parts
    const keyString = keyParts.join('|');
    const hash = createHash('sha256').update(keyString).digest('hex');
    
    return `${IDEMPOTENCY_KEY_PREFIX}generated:${hash}`;
  }

  /**
   * Check if a request is idempotent and return cached response if exists
   */
  async checkIdempotency(req: Request, options: IdempotencyOptions = {}): Promise<IdempotencyRecord | null> {
    const key = this.generateKey(req, options);
    
    try {
      const record = await this.redis.get(key);
      if (record) {
        const parsedRecord: IdempotencyRecord = JSON.parse(record);
        this.logger.debug('Idempotency hit', { key, timestamp: parsedRecord.timestamp });
        return parsedRecord;
      }
    } catch (error) {
      this.logger.error('Error checking idempotency', { key, error: error.message });
    }

    return null;
  }

  /**
   * Store response for idempotency
   */
  async storeResponse(
    req: Request,
    response: Response,
    options: IdempotencyOptions = {}
  ): Promise<void> {
    const key = this.generateKey(req, options);
    const ttl = options.ttl || DEFAULT_IDEMPOTENCY_TTL;

    // Create request hash for integrity checking
    const requestHash = this.createRequestHash(req, options);

    const record: IdempotencyRecord = {
      key,
      timestamp: Date.now(),
      ttl,
      requestHash,
    };

    // Store response if specified and within size limits
    if (options.storeResponse !== false) {
      const maxResponseSize = options.maxResponseSize || 1024 * 1024; // 1MB default
      
      let responseBody: any;
      if (response.body) {
        const bodyString = typeof response.body === 'string' 
          ? response.body 
          : JSON.stringify(response.body);
        
        if (bodyString.length <= maxResponseSize) {
          responseBody = response.body;
        } else {
          this.logger.warn('Response body too large for idempotency storage', {
            key,
            size: bodyString.length,
            maxSize: maxResponseSize,
          });
        }
      }

      record.response = {
        statusCode: response.statusCode,
        headers: response.getHeaders() as Record<string, string>,
        body: responseBody,
      };
    }

    try {
      await this.redis.setex(key, ttl, JSON.stringify(record));
      this.logger.debug('Idempotency record stored', { key, ttl });
    } catch (error) {
      this.logger.error('Error storing idempotency record', { key, error: error.message });
    }
  }

  /**
   * Clear idempotency record
   */
  async clearRecord(key: string): Promise<void> {
    try {
      await this.redis.del(key);
      this.logger.debug('Idempotency record cleared', { key });
    } catch (error) {
      this.logger.error('Error clearing idempotency record', { key, error: error.message });
    }
  }

  /**
   * Get idempotency statistics
   */
  async getStats(): Promise<{
    totalRecords: number;
    recordsByAge: Record<string, number>;
    errorRate: number;
  }> {
    try {
      const keys = await this.redis.keys(`${IDEMPOTENCY_KEY_PREFIX}*`);
      const totalRecords = keys.length;
      
      const now = Date.now();
      const recordsByAge = {
        '0-1h': 0,
        '1-6h': 0,
        '6-24h': 0,
        '24h+': 0,
      };

      // Sample a subset of records for age analysis (to avoid too many Redis calls)
      const sampleKeys = keys.slice(0, Math.min(100, keys.length));
      
      for (const key of sampleKeys) {
        try {
          const record = await this.redis.get(key);
          if (record) {
            const parsed: IdempotencyRecord = JSON.parse(record);
            const age = now - parsed.timestamp;
            const ageHours = age / (1000 * 60 * 60);

            if (ageHours <= 1) {
              recordsByAge['0-1h']++;
            } else if (ageHours <= 6) {
              recordsByAge['1-6h']++;
            } else if (ageHours <= 24) {
              recordsByAge['6-24h']++;
            } else {
              recordsByAge['24h+']++;
            }
          }
        } catch (error) {
          // Skip invalid records
        }
      }

      // Scale up the sample to estimate total
      const scaleFactor = totalRecords / sampleKeys.length;
      Object.keys(recordsByAge).forEach(key => {
        recordsByAge[key] = Math.round(recordsByAge[key] * scaleFactor);
      });

      return {
        totalRecords,
        recordsByAge,
        errorRate: 0, // Could be calculated from error logs
      };
    } catch (error) {
      this.logger.error('Error getting idempotency stats', { error: error.message });
      return {
        totalRecords: 0,
        recordsByAge: { '0-1h': 0, '1-6h': 0, '6-24h': 0, '24h+': 0 },
        errorRate: 1,
      };
    }
  }

  /**
   * Cleanup expired records
   */
  async cleanup(): Promise<number> {
    try {
      const keys = await this.redis.keys(`${IDEMPOTENCY_KEY_PREFIX}*`);
      let cleaned = 0;

      for (const key of keys) {
        try {
          const ttl = await this.redis.ttl(key);
          if (ttl === -1) { // No expiration set
            await this.redis.del(key);
            cleaned++;
          }
        } catch (error) {
          // Skip keys that can't be processed
        }
      }

      this.logger.log('Idempotency cleanup completed', { cleaned, total: keys.length });
      return cleaned;
    } catch (error) {
      this.logger.error('Error during idempotency cleanup', { error: error.message });
      return 0;
    }
  }

  /**
   * Validate request integrity against stored hash
   */
  validateRequestIntegrity(req: Request, record: IdempotencyRecord, options: IdempotencyOptions = {}): boolean {
    if (!record.requestHash) {
      return true; // No hash to validate against
    }

    const currentHash = this.createRequestHash(req, options);
    return currentHash === record.requestHash;
  }

  /**
   * Create hash of request for integrity validation
   */
  private createRequestHash(req: Request, options: IdempotencyOptions = {}): string {
    const hashParts = [
      req.method,
      req.path,
    ];

    if (options.includeQuery !== false) {
      hashParts.push(JSON.stringify(req.query));
    }

    if (options.includeBody && req.body) {
      hashParts.push(JSON.stringify(req.body));
    }

    if (options.includeHeaders && options.headersToInclude) {
      const headers = options.headersToInclude
        .map(header => `${header}:${req.headers[header.toLowerCase()]}`)
        .join('|');
      if (headers) {
        hashParts.push(headers);
      }
    }

    return createHash('sha256').update(hashParts.join('|')).digest('hex');
  }

  /**
   * Health check for idempotency service
   */
  async healthCheck(): Promise<{ status: string; redis: boolean; error?: string }> {
    try {
      await this.redis.ping();
      return { status: 'healthy', redis: true };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        redis: false, 
        error: error.message 
      };
    }
  }

  /**
   * Close Redis connection
   */
  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}
