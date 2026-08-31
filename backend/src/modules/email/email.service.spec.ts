import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { EmailService, EmailOptions } from './email.service';
import { EmailProvider, EmailSendResult } from './providers/email.provider';

describe('EmailService (#1429)', () => {
  let service: EmailService;
  let mockQueue: any;
  let mockProvider: jest.Mocked<EmailProvider>;
  let loggerSpy: jest.SpyInstance;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    mockProvider = {
      send: jest.fn().mockResolvedValue({
        success: true,
        messageId: 'test-msg-1',
      } as EmailSendResult),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: getQueueToken('email-queue'),
          useValue: mockQueue,
        },
        {
          provide: EmailProvider,
          useValue: mockProvider,
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    loggerSpy = jest.spyOn(Logger.prototype, 'log');
    loggerSpy.mockImplementation();
  });

  afterEach(() => {
    loggerSpy.mockRestore();
  });

  describe('sendEmail', () => {
    it('should queue email without logging PII', async () => {
      const emailOptions: EmailOptions = {
        to: 'user@example.com',
        subject: 'Test Email',
        template: 'welcome',
        context: { name: 'John Doe' },
      };

      await service.sendEmail(emailOptions);

      expect(mockQueue.add).toHaveBeenCalledWith('send-transactional', emailOptions, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      });

      // Verify logs do NOT contain recipient email
      const logCalls = loggerSpy.mock.calls.filter((call) =>
        call[0]?.includes('Queueing'),
      );
      expect(logCalls.length).toBeGreaterThan(0);
      expect(logCalls[0][0]).not.toContain('user@example.com');
      expect(logCalls[0][0]).toContain('welcome'); // template type is OK to log
    });
  });

  describe('processEmailJob', () => {
    it('should send email via provider', async () => {
      const emailOptions: EmailOptions = {
        to: 'user@example.com',
        subject: 'Test Subject',
        template: 'welcome',
        context: { name: 'John' },
      };

      await service.processEmailJob(emailOptions);

      expect(mockProvider.send).toHaveBeenCalled();
      const callArg = mockProvider.send.mock.calls[0][0];
      expect(callArg.to).toBe('user@example.com');
      expect(callArg.template).toBe('welcome');
      expect(callArg.html).toContain('John');
    });

    it('should log only non-PII metadata on success', async () => {
      const emailOptions: EmailOptions = {
        to: 'user@example.com',
        subject: 'Welcome',
        template: 'welcome',
        context: { name: 'Alice' },
      };

      await service.processEmailJob(emailOptions);

      // Check that logs contain template and messageId, but not recipient or HTML
      const successLogs = loggerSpy.mock.calls.filter((call) =>
        call[0]?.includes('Email sent successfully'),
      );
      expect(successLogs.length).toBeGreaterThan(0);
      const successLog = successLogs[0][0];
      expect(successLog).toContain('template=welcome');
      expect(successLog).toContain('messageId=');
      expect(successLog).not.toContain('user@example.com');
      expect(successLog).not.toContain('Alice');
    });

    it('should log error but not PII when provider fails', async () => {
      mockProvider.send.mockRejectedValueOnce(new Error('Provider timeout'));

      const emailOptions: EmailOptions = {
        to: 'user@example.com',
        subject: 'Test',
        template: 'password-reset',
        context: { url: 'https://example.com/reset?token=secret' },
      };

      await expect(service.processEmailJob(emailOptions)).rejects.toThrow();

      // Check error logs
      const errorLogs = loggerSpy.mock.calls.filter(
        (call) => call[0]?.includes('Failed to send'),
      );
      expect(errorLogs.length).toBeGreaterThan(0);
      const errorLog = errorLogs[0][0];
      expect(errorLog).toContain('template=password-reset');
      expect(errorLog).toContain('Provider timeout');
      expect(errorLog).not.toContain('user@example.com');
      expect(errorLog).not.toContain('secret');
    });

    it('should throw when provider returns failure', async () => {
      mockProvider.send.mockResolvedValueOnce({
        success: false,
        messageId: '',
        error: 'Invalid recipient',
      } as EmailSendResult);

      const emailOptions: EmailOptions = {
        to: 'invalid@',
        subject: 'Test',
        template: 'alert',
        context: { message: 'Alert content' },
      };

      await expect(service.processEmailJob(emailOptions)).rejects.toThrow();

      const errorLogs = loggerSpy.mock.calls.filter((call) =>
        call[0]?.includes('Email send failed'),
      );
      expect(errorLogs.length).toBeGreaterThan(0);
      expect(errorLogs[0][0]).not.toContain('Alert content');
    });
  });

  describe('template rendering', () => {
    it('should render welcome template', async () => {
      mockProvider.send.mockImplementationOnce(async (data) => {
        expect(data.html).toContain('Welcome, Bob!');
        return { success: true, messageId: 'test' };
      });

      await service.processEmailJob({
        to: 'bob@example.com',
        subject: 'Welcome',
        template: 'welcome',
        context: { name: 'Bob' },
      });
    });

    it('should render password-reset template', async () => {
      mockProvider.send.mockImplementationOnce(async (data) => {
        expect(data.html).toContain('https://reset.example.com');
        return { success: true, messageId: 'test' };
      });

      await service.processEmailJob({
        to: 'user@example.com',
        subject: 'Reset Password',
        template: 'password-reset',
        context: { url: 'https://reset.example.com' },
      });
    });

    it('should render alert template', async () => {
      mockProvider.send.mockImplementationOnce(async (data) => {
        expect(data.html).toContain('Suspicious login');
        return { success: true, messageId: 'test' };
      });

      await service.processEmailJob({
        to: 'user@example.com',
        subject: 'Security Alert',
        template: 'alert',
        context: { message: 'Suspicious login detected' },
      });
    });
  });
});
