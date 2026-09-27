import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Waitlist } from './entities/waitlist.entity';
import { WaitlistService } from './waitlist.service';
import { WaitlistController } from './waitlist.controller';
import { WaitlistAdminController } from './waitlist-admin.controller';
import { AdminLogsModule } from '../admin-logs/admin-logs.module';
import { AuditTrailModule } from '../audit-trail/audit-trail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Waitlist]),
    AdminLogsModule,
    AuditTrailModule,
  ],
  controllers: [WaitlistController, WaitlistAdminController],
  providers: [WaitlistService],
  exports: [WaitlistService],
})
export class WaitlistModule {}
