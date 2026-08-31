import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { JobsMetricsService } from '../jobs-metrics.service';

/** Max jobs this worker processes concurrently; override via JOBS_CONCURRENCY. */
const JOBS_CONCURRENCY = Number(process.env.JOBS_CONCURRENCY) || 5;

@Processor('background-jobs', { concurrency: JOBS_CONCURRENCY })
export class SampleProcessor extends WorkerHost {
  private readonly logger = new Logger(SampleProcessor.name);

  constructor(private readonly jobsMetrics: JobsMetricsService) {
    super();
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<any, any, string> | undefined, err: Error): void {
    this.logger.error(`Job ${job?.id} (${job?.name}) failed: ${err.message}`);
    this.jobsMetrics.recordFailure('background-jobs', job?.name ?? 'unknown');
  }

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
