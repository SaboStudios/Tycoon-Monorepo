import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TracingService } from './tracing.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [TracingService],
  exports: [TracingService],
})
export class TracingModule {}