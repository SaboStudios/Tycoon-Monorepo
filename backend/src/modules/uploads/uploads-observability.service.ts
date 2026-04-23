import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Counter, Histogram } from 'prom-client';
import { randomBytes } from 'crypto';

export type UploadOutcomeLabel =
  | 'success'
  | 'validation_error'
  | 'multer_error'
  | 'virus_error'
  | 'storage_error'
  | 'unknown_error';

@Injectable()
export class UploadsObservabilityService {
  private readonly logger = new Logger(UploadsObservabilityService.name);
  private readonly enabled: boolean;
  private readonly requestsTotal: Counter;
  private readonly requestDuration: Histogram;
  private readonly multerErrorsTotal: Counter;
  private readonly virusScanTotal: Counter;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get<boolean>('upload.observabilityEnabled') !== false;

    this.requestsTotal = new Counter({
      name: 'tycoon_uploads_requests_total',
      help: 'Uploads-related HTTP requests by coarse route and outcome',
      labelNames: ['route', 'outcome'],
    });

    this.requestDuration = new Histogram({
      name: 'tycoon_uploads_request_duration_seconds',
      help: 'Duration of uploads-related HTTP handlers in seconds',
      labelNames: ['route', 'outcome'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 15],
    });

    this.multerErrorsTotal = new Counter({
      name: 'tycoon_uploads_multer_errors_total',
      help: 'Multer errors by multer error code',
      labelNames: ['code'],
    });

    this.virusScanTotal = new Counter({
      name: 'tycoon_uploads_virus_scan_total',
      help: 'ClamAV scan outcomes (skipped when CLAMAV_HOST unset)',
      labelNames: ['outcome'],
    });
  }

  createTraceContext(route: string, traceId?: string) {
    return {
      trace_id: traceId || this.generateTraceId(),
      route,
      ts: new Date().toISOString(),
    };
  }

  recordUploadOutcome(params: {
    route: string;
    outcome: UploadOutcomeLabel;
    durationSeconds: number;
    traceId: string;
    mimeType?: string;
    sizeBytes?: number;
  }): void {
    if (!this.enabled) return;
    const { route, outcome, durationSeconds, traceId, mimeType, sizeBytes } = params;
    this.requestsTotal.inc({ route, outcome });
    this.requestDuration.observe({ route, outcome }, durationSeconds);

    this.logger.debug('upload_request', {
      ...this.createTraceContext(route, traceId),
      outcome,
      duration_ms: Math.round(durationSeconds * 1000),
      mimeType: mimeType ?? 'n/a',
      sizeBytes: sizeBytes ?? 'n/a',
    });
  }

  recordMulterError(code: string): void {
    if (!this.enabled) return;
    this.multerErrorsTotal.inc({ code: code || 'UNKNOWN' });
    this.logger.warn(`upload_multer_error code=${code || 'UNKNOWN'}`);
  }

  recordVirusScanOutcome(outcome: 'skipped' | 'clean' | 'infected' | 'error'): void {
    if (!this.enabled) return;
    this.virusScanTotal.inc({ outcome });
    this.logger.debug(`virus_scan outcome=${outcome}`);
  }

  private generateTraceId(): string {
    return randomBytes(8).toString('hex');
  }
}
