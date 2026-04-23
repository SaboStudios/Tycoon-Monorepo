import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadsEnhancedController } from './uploads-enhanced.controller';
import { UploadsService } from './uploads.service';
import { VirusScanService } from './virus-scan.service';
import { IdempotencyService } from './idempotency/idempotency.service';
import { IdempotencyInterceptor } from './idempotency/idempotency.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';

@Module({
  controllers: [UploadsController, UploadsEnhancedController],
  providers: [
    UploadsService,
    VirusScanService,
    IdempotencyService,
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
  exports: [UploadsService, VirusScanService, IdempotencyService],
})
export class UploadsEnhancedModule {}
