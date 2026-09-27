import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditTrail } from './entities/audit-trail.entity';
import { AuditTrailService } from './audit-trail.service';

@Module({
    imports: [TypeOrmModule.forFeature([AuditTrail])],
    providers: [AuditTrailService],
    exports: [AuditTrailService],
})
export class AuditTrailModule { }
