/**
 * Issue #1314 — SampleProcessor: failed-job metric recording.
 */
import { SampleProcessor } from './sample.processor';
import { JobsMetricsService } from '../jobs-metrics.service';

describe('SampleProcessor', () => {
  let jobsMetrics: { recordFailure: jest.Mock };
  let processor: SampleProcessor;

  beforeEach(() => {
    jobsMetrics = { recordFailure: jest.fn() };
    processor = new SampleProcessor(jobsMetrics as unknown as JobsMetricsService);
  });

  it('records a failure metric with the queue and job name on the failed event', () => {
    const job = { id: '1', name: 'sample-echo' } as any;
    processor.onFailed(job, new Error('boom'));

    expect(jobsMetrics.recordFailure).toHaveBeenCalledWith(
      'background-jobs',
      'sample-echo',
    );
  });

  it('falls back to "unknown" job name when the job is undefined', () => {
    processor.onFailed(undefined, new Error('boom'));

    expect(jobsMetrics.recordFailure).toHaveBeenCalledWith(
      'background-jobs',
      'unknown',
    );
  });

  it('processes a known job type', async () => {
    const job = { id: '1', name: 'sample-echo', data: { message: 'hi' } } as any;
    await expect(processor.process(job)).resolves.toEqual({
      success: true,
      echoed: 'hi',
    });
  });
});
