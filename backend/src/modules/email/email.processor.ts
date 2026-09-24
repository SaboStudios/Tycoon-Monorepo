import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EmailService, EmailOptions } from './email.service';

@Processor('email-queue')
export class EmailProcessor extends WorkerHost {
  constructor(private readonly emailService: EmailService) {
    super();
  }

  async process(job: Job<EmailOptions, any, string>): Promise<void> {
    if (job.name === 'send-transactional') {
      await this.emailService.processEmailJob(job.data);
    }
  }
}
