import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminLog } from './entities/admin-log.entity';
import { AdminLogsService } from './admin-logs.service';
import { AdminLogsController } from './admin-logs.controller';
import { PaginationService } from '../../common';
import { AuditTrailModule } from '../audit-trail/audit-trail.module';

@Module({
  imports: [TypeOrmModule.forFeature([AdminLog]), AuditTrailModule],
  providers: [AdminLogsService, PaginationService],
  controllers: [AdminLogsController],
  exports: [AdminLogsService],
})
export class AdminLogsModule {}
