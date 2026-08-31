import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhooksObservabilityService } from './webhooks-observability.service';
import { WebhooksAuditService } from './webhooks-audit.service';
import { WebhookAuditHooksService } from './webhook-audit-hooks.service';
import { RedisModule } from '../redis/redis.module';
import { WebhookEvent } from './entities/webhook-event.entity';
import { WebhookAuditLog } from './entities/webhook-audit-log.entity';
import { LoggerModule } from '../../common/logger/logger.module';
import { AuditTrailModule } from '../audit-trail/audit-trail.module';

@Module({
  imports: [
    RedisModule,
    LoggerModule,
    AuditTrailModule,
    TypeOrmModule.forFeature([WebhookEvent, WebhookAuditLog]),
  ],
  controllers: [WebhooksController],
  providers: [
    WebhooksService,
    WebhooksObservabilityService,
    WebhooksAuditService,
    WebhookAuditHooksService,
  ],
  exports: [
    WebhooksService,
    WebhooksObservabilityService,
    WebhooksAuditService,
    WebhookAuditHooksService,
  ],
})
export class WebhooksModule {}
