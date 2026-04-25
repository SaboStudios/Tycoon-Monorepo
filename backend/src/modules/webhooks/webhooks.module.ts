import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhooksObservabilityService } from './webhooks-observability.service';
import { RedisModule } from '../redis/redis.module';
import { WebhookEvent } from './entities/webhook-event.entity';
import { LoggerModule } from '../../common/logger/logger.module';

@Module({
  imports: [RedisModule, LoggerModule, TypeOrmModule.forFeature([WebhookEvent])],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhooksObservabilityService],
  exports: [WebhooksService, WebhooksObservabilityService],
})
export class WebhooksModule {}
