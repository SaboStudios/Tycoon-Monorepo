import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailProvider } from './email.provider';
import { NoOpEmailProvider } from './noop.provider';

/**
 * Factory for creating the appropriate email provider based on environment configuration.
 * Currently supports:
 *   - 'noop': No-op provider (development/test, no emails sent)
 *
 * Future providers can be added here as implementations are built:
 *   - 'sendgrid': SendGrid provider
 *   - 'ses': AWS SES provider
 *   - 'smtp': Generic SMTP provider
 */
@Injectable()
export class EmailProviderFactory {
  constructor(private readonly configService: ConfigService) {}

  createProvider(): EmailProvider {
    const providerType = this.configService.get<string>(
      'email.provider',
      'noop',
    );
    const nodeEnv = this.configService.get<string>('app.nodeEnv');

    // In production, require an explicit non-noop provider
    if (nodeEnv === 'production' && providerType === 'noop') {
      throw new Error(
        'EMAIL_PROVIDER must be set to a real provider (e.g., sendgrid, ses) in production. ' +
          'noop provider is only allowed in development and test environments.',
      );
    }

    switch (providerType) {
      case 'noop':
        return new NoOpEmailProvider();
      default:
        throw new Error(
          `Unknown EMAIL_PROVIDER: ${providerType}. ` +
            'Supported providers: noop',
        );
    }
  }
}
