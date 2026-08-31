export interface EmailData {
  to: string;
  subject: string;
  template: string;
  html: string;
  context: Record<string, any>;
}

export interface EmailSendResult {
  messageId: string;
  success: boolean;
  error?: string;
}

/**
 * Abstract email provider interface.
 * Implementations should NOT log or expose email content (HTML, recipient, context).
 */
export interface EmailProvider {
  send(data: EmailData): Promise<EmailSendResult>;
}
