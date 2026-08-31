import { NoOpEmailProvider } from './noop.provider';
import { EmailData } from './email.provider';

describe('NoOpEmailProvider', () => {
  let provider: NoOpEmailProvider;

  beforeEach(() => {
    provider = new NoOpEmailProvider();
  });

  it('should silently succeed without sending', async () => {
    const emailData: EmailData = {
      to: 'test@example.com',
      subject: 'Test Subject',
      template: 'welcome',
      html: '<h1>Welcome</h1>',
      context: { name: 'Test User' },
    };

    const result = await provider.send(emailData);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.messageId).toBeDefined();
  });

  it('should generate unique message IDs', async () => {
    const emailData: EmailData = {
      to: 'test@example.com',
      subject: 'Test',
      template: 'welcome',
      html: '<p>Test</p>',
      context: {},
    };

    const result1 = await provider.send(emailData);
    const result2 = await provider.send(emailData);

    expect(result1.messageId).not.toBe(result2.messageId);
  });
});
