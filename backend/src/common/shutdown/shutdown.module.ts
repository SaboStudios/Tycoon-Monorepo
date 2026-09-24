import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { GracefulShutdownService } from './graceful-shutdown.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([]),
    BullModule.registerQueue(
      { name: 'background-jobs' },
      { name: 'email-queue' },
    ),
  ],
  providers: [GracefulShutdownService],
  exports: [GracefulShutdownService],
})
export class ShutdownModule {}
