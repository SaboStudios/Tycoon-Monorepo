import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export interface EmailOptions {
  to: string;
  subject: string;
  template: 'welcome' | 'password-reset' | 'alert';
  context: Record<string, any>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(@InjectQueue('email-queue') private readonly emailQueue: Queue) {}

  /**
   * Send an email by adding it to the background queue
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    this.logger.log(`Queueing ${options.template} email to ${options.to}`);

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
   */
  async processEmailJob(options: EmailOptions): Promise<void> {
    this.logger.log(`Processing email job for ${options.to}`);

    // In a real implementation, this would use a provider like SendGrid or Mailgun.
    // For staging/dev, we can log it or send to a mail catcher.
    const html = this.renderTemplate(options.template, options.context);

    this.logger.log(`
      --- EMAIL SENT ---
      To: ${options.to}
      Subject: ${options.subject}
      Body: ${html.substring(0, 50)}...
      ------------------
    `);
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
