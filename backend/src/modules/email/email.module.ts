import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';
import { EmailProviderFactory } from './providers/email-provider.factory';
import { NoOpEmailProvider } from './providers/noop.provider';
import { JobsModule } from '../jobs/jobs.module';
import { BullModule } from '@nestjs/bullmq';
import { EmailProvider } from './providers/email.provider';

/**
 * EmailModule
 *
 * Queue: `email-queue`
 *   - Max attempts : 3  (exponential backoff, base delay 5 000 ms)
 *   - On exhaustion: job is kept in the failed set (`removeOnFail: false`) and
 *     the processor emits a structured error log referencing the recipient and
 *     template.  Use the BullMQ dashboard (Bull Board) or the Redis CLI to
 *     inspect / replay DLQ entries:
 *       LRANGE bull:email-queue:failed 0 -1
 *
 * Email Provider:
 *   - Configured via EMAIL_PROVIDER env var (default: 'noop')
 *   - Development/test: 'noop' (no emails sent)
 *   - Production: must be set to a real provider (e.g., 'sendgrid', 'ses')
 */
@Module({
  imports: [
    ConfigModule,
    JobsModule,
    BullModule.registerQueue({
      name: 'email-queue',
    }),
  ],
  providers: [
    EmailProviderFactory,
    EmailService,
    EmailProcessor,
    {
      provide: EmailProvider,
      useFactory: (factory: EmailProviderFactory) => factory.createProvider(),
      inject: [EmailProviderFactory],
    },
  ],
  exports: [EmailService],
})
export class EmailModule {}
