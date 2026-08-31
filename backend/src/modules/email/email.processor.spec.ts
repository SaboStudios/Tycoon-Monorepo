import { Test, TestingModule } from '@nestjs/testing';
import { EmailProcessor } from './email.processor';
import { EmailService } from './email.service';

const mockEmailService = {
  processEmailJob: jest.fn(),
};

const buildJob = (overrides: Partial<any> = {}): any => ({
  id: 'job-1',
  name: 'send-transactional',
  attemptsMade: 0,
  opts: { attempts: 3 },
  data: {
    to: 'user@example.com',
    subject: 'Test',
    template: 'welcome',
    context: { name: 'Test' },
  },
  ...overrides,
});

describe('EmailProcessor', () => {
  let processor: EmailProcessor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProcessor,
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    processor = module.get<EmailProcessor>(EmailProcessor);
    jest.clearAllMocks();
  });

  describe('process()', () => {
    it('calls emailService.processEmailJob for send-transactional jobs', async () => {
      const job = buildJob();
      await processor.process(job);
      expect(mockEmailService.processEmailJob).toHaveBeenCalledWith(job.data);
    });

    it('ignores jobs with unrecognised names', async () => {
      const job = buildJob({ name: 'unknown-job' });
      await processor.process(job);
      expect(mockEmailService.processEmailJob).not.toHaveBeenCalled();
    });

    it('propagates errors thrown by emailService (so BullMQ can retry)', async () => {
      const err = new Error('SMTP unavailable');
      mockEmailService.processEmailJob.mockRejectedValueOnce(err);
      const job = buildJob();
      await expect(processor.process(job)).rejects.toThrow('SMTP unavailable');
    });
  });

  describe('onFailed()', () => {
    it('logs a DLQ error when all attempts are exhausted', () => {
      const logSpy = jest.spyOn((processor as any).logger, 'error').mockImplementation(() => {});
      const job = buildJob({ attemptsMade: 3, opts: { attempts: 3 } });
      processor.onFailed(job, new Error('SMTP down'));
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('DLQ'),
        expect.any(String),
      );
    });

    it('logs a warning (not error) for intermediate failures', () => {
      const warnSpy = jest.spyOn((processor as any).logger, 'warn').mockImplementation(() => {});
      const job = buildJob({ attemptsMade: 1, opts: { attempts: 3 } });
      processor.onFailed(job, new Error('transient'));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('retry'));
    });
  });

  describe('onCompleted()', () => {
    it('logs successful completion', () => {
      const logSpy = jest.spyOn((processor as any).logger, 'log').mockImplementation(() => {});
      const job = buildJob();
      processor.onCompleted(job);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('completed successfully'));
    });
  });
});
