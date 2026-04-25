import { Controller, Get, Header, UseInterceptors } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { HttpMetricsService } from './http-metrics.service';
import { AuditTrailInterceptor } from '../audit-trail/audit-trail.interceptor';
import { AuditLog } from '../audit-trail/audit-log.decorator';
import { AuditAction } from '../audit-trail/entities/audit-trail.entity';

@ApiExcludeController()
@SkipThrottle()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly httpMetrics: HttpMetricsService) { }

  @Get()
  @UseInterceptors(AuditTrailInterceptor)
  @AuditLog(AuditAction.METRICS_SCRAPED)
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async scrape(): Promise<string> {
    return this.httpMetrics.getMetricsText();
  }
}
