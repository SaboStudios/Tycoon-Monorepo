import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';

@Processor('background-jobs')
export class SampleProcessor extends WorkerHost {
  private readonly logger = new Logger(SampleProcessor.name);

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}...`);

    switch (job.name) {
      case 'sample-echo':
        this.logger.log(`Echo: ${job.data.message}`);
        return { success: true, echoed: job.data.message };

      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
        return { success: false, error: 'unknown_job_type' };
    }
  }
}
