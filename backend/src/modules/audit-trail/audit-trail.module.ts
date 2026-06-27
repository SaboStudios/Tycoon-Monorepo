import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditTrail } from './entities/audit-trail.entity';
import { AuditTrailService } from './audit-trail.service';
import { AuditTrailInterceptor } from './audit-trail.interceptor';
import { AuditTrailController } from './audit-trail.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AuditTrail])],
  controllers: [AuditTrailController],
  providers: [AuditTrailService, AuditTrailInterceptor],
  exports: [AuditTrailService, AuditTrailInterceptor],
})
export class AuditTrailModule {}
