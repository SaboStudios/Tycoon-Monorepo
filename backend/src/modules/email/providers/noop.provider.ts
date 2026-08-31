import { Injectable } from '@nestjs/common';
import { EmailProvider, EmailData, EmailSendResult } from './email.provider';

/**
 * No-op email provider for development and test environments.
 * Silently succeeds without sending any emails.
 */
@Injectable()
export class NoOpEmailProvider implements EmailProvider {
  async send(data: EmailData): Promise<EmailSendResult> {
    // Silently succeed without sending anything
    // MessageId is a dummy value for local testing
    return {
      messageId: `noop-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      success: true,
    };
  }
}
