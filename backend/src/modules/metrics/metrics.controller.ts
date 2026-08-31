import {
  Controller,
  ForbiddenException,
  Get,
  Header,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiExcludeController,
  ApiOperation,
  ApiProduces,
  ApiResponse,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { HttpMetricsService } from './http-metrics.service';
import { AuditTrailInterceptor } from '../audit-trail/audit-trail.interceptor';
import { AuditLog } from '../audit-trail/audit-log.decorator';
import { AuditAction } from '../audit-trail/entities/audit-trail.entity';

/**
 * MetricsController — Prometheus scrape endpoint.
 *
 * Route:    GET /metrics
 * Auth:     None (network-level access control expected; METRICS_ENABLED flag).
 * Response: Prometheus text exposition format 0.0.4.
 *
 * The endpoint is excluded from the public Swagger UI via @ApiExcludeController
 * but the annotations below are kept for IDE navigation and contract clarity.
 */
@ApiExcludeController()
@SkipThrottle()
@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly httpMetrics: HttpMetricsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @UseInterceptors(AuditTrailInterceptor)
  @AuditLog(AuditAction.METRICS_SCRAPED)
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({
    summary: 'Prometheus metrics scrape endpoint',
    description:
      'Returns all registered metrics in Prometheus text exposition format 0.0.4. ' +
      'Disabled (403) when METRICS_ENABLED env var is set to false.',
  })
  @ApiProduces('text/plain')
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Prometheus text exposition format payload.',
    content: {
      'text/plain': {
        schema: { type: 'string' },
        example:
          '# HELP tycoon_http_requests_total Total HTTP requests\n' +
          '# TYPE tycoon_http_requests_total counter\n' +
          'tycoon_http_requests_total{method="GET",route_group="public",status_class="2xx"} 5\n',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Metrics endpoint is disabled (METRICS_ENABLED=false).',
  })
  async scrape(): Promise<string> {
    if (!this.config.get<boolean>('METRICS_ENABLED', true)) {
      throw new ForbiddenException('Metrics endpoint is disabled');
    }
    return this.httpMetrics.getMetricsText();
  }
}

