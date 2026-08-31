import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmailService, EmailOptions } from './email.service';

/**
 * Email queue processor.
 *
 * Retry policy (configured at enqueue time in EmailService):
 *   - Max attempts : 3
 *   - Backoff      : exponential, starting at 5 000 ms
 *
 * Dead-Letter Queue (DLQ):
 *   - Jobs that exhaust all attempts are NOT removed (`removeOnFail: false`).
 *   - They remain in the "failed" set of `email-queue` and can be inspected or
 *     re-queued via the BullMQ dashboard / Bull Board.
 *   - The `failed` event handler below logs a structured error so on-call
 *     engineers can identify and replay DLQ entries.
 */
@Processor('email-queue')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly emailService: EmailService) {
    super();
  }

  async process(job: Job<EmailOptions, void, string>): Promise<void> {
    if (job.name === 'send-transactional') {
      this.logger.log(
        `Processing email job ${job.id} (attempt ${job.attemptsMade + 1} of ${job.opts.attempts ?? 1})`,
      );
      await this.emailService.processEmailJob(job.data);
    }
  }

  /** Fires after each failed attempt (including intermediate retries). */
  @OnWorkerEvent('failed')
  onFailed(job: Job<EmailOptions>, error: Error): void {
    const isExhausted = job.attemptsMade >= (job.opts.attempts ?? 1);

    if (isExhausted) {
      this.logger.error(
        `Email job ${job.id} moved to DLQ after ${job.attemptsMade} attempt(s). ` +
          `Recipient: ${job.data?.to ?? 'unknown'}, Template: ${job.data?.template ?? 'unknown'}. ` +
          `Error: ${error.message}`,
        error.stack,
      );
    } else {
      this.logger.warn(
        `Email job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts ?? 1}). ` +
          `Will retry. Error: ${error.message}`,
      );
    }
  }

  /** Fires on successful completion. */
  @OnWorkerEvent('completed')
  onCompleted(job: Job<EmailOptions>): void {
    this.logger.log(`Email job ${job.id} completed successfully.`);
  }
}
