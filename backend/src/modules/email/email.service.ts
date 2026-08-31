import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EmailProvider } from './providers/email.provider';

export interface EmailOptions {
  to: string;
  subject: string;
  template: 'welcome' | 'password-reset' | 'alert';
  context: Record<string, any>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @InjectQueue('email-queue') private readonly emailQueue: Queue,
    private readonly emailProvider: EmailProvider,
  ) {}

  /**
   * Send an email by adding it to the background queue
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    // Log only non-sensitive metadata: template type and job queue action
    this.logger.log(`Queueing ${options.template} email`);

    await this.emailQueue.add('send-transactional', options, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  /**
   * Actually send the email (called by the worker)
   * Does not log full HTML or PII; logs only non-sensitive metadata
   */
  async processEmailJob(options: EmailOptions): Promise<void> {
    const html = this.renderTemplate(options.template, options.context);

    try {
      const result = await this.emailProvider.send({
        to: options.to,
        subject: options.subject,
        template: options.template,
        html,
        context: options.context,
      });

      if (result.success) {
        // Log only non-PII metadata: template, message ID, status
        this.logger.log(
          `Email sent successfully: template=${options.template}, messageId=${result.messageId}`,
        );
      } else {
        this.logger.error(
          `Email send failed: template=${options.template}, error=${result.error}`,
        );
        throw new Error(result.error || 'Email provider returned failure');
      }
    } catch (error) {
      // Log error but not the full email content
      this.logger.error(
        `Failed to send email: template=${options.template}, error=${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  private renderTemplate(
    template: string,
    context: Record<string, any>,
  ): string {
    // Simple template rendering logic
    switch (template) {
      case 'welcome':
        return `<h1>Welcome, ${context.name}!</h1><p>We're glad to have you on board Tycoon.</p>`;
      case 'password-reset':
        return `<h1>Password Reset</h1><p>Click <a href="${context.url}">here</a> to reset your password.</p>`;
      case 'alert':
        return `<h1>Security Alert</h1><p>${context.message}</p>`;
      default:
        return `<p>${JSON.stringify(context)}</p>`;
    }
  }
}
