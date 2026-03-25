import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';
import { JobsModule } from '../jobs/jobs.module';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    JobsModule,
    BullModule.registerQueue({
      name: 'email-queue',
    }),
  ],
  providers: [EmailService, EmailProcessor],
  exports: [EmailService],
})
export class EmailModule {}
