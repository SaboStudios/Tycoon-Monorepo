import { Module } from '@nestjs/common';
import { MuxProtocolService } from './mux-protocol.service';
import { MuxAuditService } from './mux-audit.service';

@Module({
  providers: [MuxProtocolService, MuxAuditService],
  exports: [MuxProtocolService, MuxAuditService],
})
export class MuxProtocolModule {}
