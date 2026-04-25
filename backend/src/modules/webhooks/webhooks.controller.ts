import {
  Controller,
  Post,
  Get,
  Headers,
  Req,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { WebhooksObservabilityService } from './webhooks-observability.service';
import { WebhooksAuditService } from './webhooks-audit.service';
import { Request } from 'express';
import { StripeWebhookDto } from './dto/webhook.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly observability: WebhooksObservabilityService,
    private readonly auditService: WebhooksAuditService,
  ) {}

  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(
    @Headers('x-stripe-signature') signature: string,
    @Headers('x-stripe-timestamp') timestamp: string,
    @Req() req: Request & { rawBody: Buffer; ip: string },
    @Body() body: StripeWebhookDto,
  ) {
    try {
      const ipAddress = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      const isValid = await this.webhooksService.verifySignature(
        signature,
        timestamp,
        req.rawBody,
        'stripe',
        ipAddress,
      );

      if (!isValid) {
        throw new UnauthorizedException('Invalid webhook signature');
      }

      return await this.webhooksService.processWebhook(
        body,
        'stripe',
        ipAddress,
        userAgent,
      );
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException('Invalid webhook payload');
    }
  }

  /**
   * SW-BE-020: List stored webhook events with pagination and stable sorting.
   * GET /webhooks/events?page=1&limit=20&sortBy=createdAt&sortOrder=DESC
   */
  @Get('events')
  listEvents(@Query() query: PaginationDto) {
    return this.webhooksService.listEvents(query);
  }

  /**
   * Prometheus metrics endpoint for webhook observability
   * GET /webhooks/metrics
   */
  @Get('metrics')
  async getMetrics() {
    return this.observability.getMetricsText();
  }

  /**
   * Get audit logs for a specific webhook
   * GET /webhooks/audit/:webhookId
   */
  @Get('audit/:webhookId')
  async getAuditLogs(@Param('webhookId') webhookId: string) {
    return this.auditService.getAuditLogsForWebhook(webhookId);
  }

  /**
   * Get failed webhook operations for investigation
   * GET /webhooks/audit/failed?source=stripe&limit=100
   */
  @Get('audit-failed')
  async getFailedOperations(
    @Query('source') source?: string,
    @Query('limit') limit?: number,
  ) {
    return this.auditService.getFailedOperations(source, limit);
  }

  /**
   * Get audit statistics for a time period
   * GET /webhooks/audit-stats?startDate=2024-01-01&endDate=2024-01-31&source=stripe
   */
  @Get('audit-stats')
  async getAuditStatistics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('source') source?: string,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    return this.auditService.getAuditStatistics(start, end, source);
  }
}
