import {
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import {
  STALE_ACTIVE_EXPORT_MS,
  UserDataExportService,
} from './user-data-export.service';
import { UserDataExportJob } from './entities/user-data-export-job.entity';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { AuditAction } from '../audit-trail/entities/audit-trail.entity';
import { DataExportMetrics } from './data-export.metrics';

type JobRow = Partial<UserDataExportJob> & { id: number };

describe('UserDataExportService (#1766)', () => {
  let service: UserDataExportService;
  let jobs: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let queue: { add: jest.Mock };
  let audit: { log: jest.Mock };
  let metrics: { recordRequest: jest.Mock; recordJob: jest.Mock };
  let settings: Record<string, unknown>;
  let nextId: number;

  beforeEach(() => {
    nextId = 1;
    settings = {
      'app.dataExportEnabled': true,
      'app.dataExportEnqueueTimeoutMs': 50,
      'app.dataExportTtlHours': 24,
    };
    jobs = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data: Partial<UserDataExportJob>) => ({ ...data })),
      save: jest.fn(async (row: JobRow) => {
        if (!row.id) {
          row.id = nextId++;
          row.createdAt = new Date();
        }
        return row;
      }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    queue = { add: jest.fn().mockResolvedValue({ id: 'bull-1' }) };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    metrics = { recordRequest: jest.fn(), recordJob: jest.fn() };

    service = new UserDataExportService(
      queue as unknown as Queue,
      jobs as unknown as Repository<UserDataExportJob>,
      { get: jest.fn((k: string) => settings[k]) } as unknown as ConfigService,
      new JwtService({ secret: 'unit-test-only' }),
      audit as unknown as AuditTrailService,
      metrics as unknown as DataExportMetrics,
    );
  });

  describe('requestExport', () => {
    it('creates a job, enqueues it with a deterministic Bull id and audits', async () => {
      const result = await service.requestExport(5, { ipAddress: '198.51.100.1' });

      expect(result).toEqual({ jobId: 1, status: 'pending', reused: false });
      expect(queue.add).toHaveBeenCalledWith(
        'export-user-data',
        { jobId: 1, userId: 5 },
        expect.objectContaining({ jobId: 'user-data-export-1' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        AuditAction.DATA_EXPORT_REQUESTED,
        expect.objectContaining({ userId: 5, changes: { jobId: 1 } }),
      );
      expect(metrics.recordRequest).toHaveBeenCalledWith('created');
    });

    it('returns the active job instead of enqueuing a duplicate (retry / double click)', async () => {
      jobs.findOne.mockResolvedValue({
        id: 9,
        userId: 5,
        status: 'processing',
        createdAt: new Date(),
      });

      const result = await service.requestExport(5);

      expect(result).toEqual({ jobId: 9, status: 'processing', reused: true });
      expect(jobs.save).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
      expect(metrics.recordRequest).toHaveBeenCalledWith('reused');
    });

    it('collapses a concurrent duplicate that loses the unique-index race', async () => {
      jobs.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 3, status: 'pending', createdAt: new Date() });
      jobs.save.mockRejectedValueOnce(
        Object.assign(new Error('duplicate key'), { code: '23505' }),
      );

      const result = await service.requestExport(5);

      expect(result).toEqual({ jobId: 3, status: 'pending', reused: true });
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('supersedes a stale active job and starts a new export', async () => {
      const stale = {
        id: 2,
        userId: 5,
        status: 'processing',
        createdAt: new Date(Date.now() - STALE_ACTIVE_EXPORT_MS - 1000),
      };
      jobs.findOne.mockResolvedValue(stale);

      const result = await service.requestExport(5);

      expect(stale.status).toBe('failed');
      expect(result.reused).toBe(false);
      expect(queue.add).toHaveBeenCalled();
    });

    it('fails closed with 503 and deletes the row when the queue rejects (Redis down)', async () => {
      queue.add.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.requestExport(5)).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(jobs.delete).toHaveBeenCalledWith({ id: 1 });
      expect(audit.log).not.toHaveBeenCalled();
      expect(metrics.recordRequest).toHaveBeenCalledWith('enqueue_failed');
    });

    it('fails closed with 503 when the queue hangs past the enqueue timeout', async () => {
      queue.add.mockReturnValue(new Promise(() => undefined));

      await expect(service.requestExport(5)).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(jobs.delete).toHaveBeenCalledWith({ id: 1 });
    });

    it('maps a Postgres outage to 503, not a raw 500', async () => {
      jobs.findOne.mockRejectedValue(new Error('connect ECONNREFUSED 5432'));

      await expect(service.requestExport(5)).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('rejects new requests with 503 when the kill switch is off', async () => {
      settings['app.dataExportEnabled'] = false;

      await expect(service.requestExport(5)).rejects.toThrow(
        'Data export is temporarily disabled',
      );
      expect(jobs.findOne).not.toHaveBeenCalled();
      expect(metrics.recordRequest).toHaveBeenCalledWith('disabled');
    });
  });

  describe('getStatus', () => {
    it("returns 404 for another user's job (no enumeration)", async () => {
      jobs.findOne.mockResolvedValue(null);

      await expect(service.getStatus(5, 42)).rejects.toThrow(NotFoundException);
      expect(jobs.findOne).toHaveBeenCalledWith({ where: { id: 42, userId: 5 } });
    });

    it('omits downloadUrl until the job is ready', async () => {
      jobs.findOne.mockResolvedValue({ id: 1, userId: 5, status: 'pending' });

      const status = await service.getStatus(5, 1);
      expect(status.downloadUrl).toBeUndefined();
    });

    it('issues a job-bound download token when ready', async () => {
      jobs.findOne.mockResolvedValue({
        id: 1,
        userId: 5,
        status: 'ready',
        filePath: '/tmp/export-1.json',
      });

      const status = await service.getStatus(5, 1);

      expect(status.downloadUrl).toMatch(
        /^\/api\/v1\/data-export\/download\?token=/,
      );
      const token = decodeURIComponent(status.downloadUrl!.split('token=')[1]);
      const payload = new JwtService({ secret: 'unit-test-only' }).verify(token);
      expect(payload).toEqual(
        expect.objectContaining({ sub: 5, jobId: 1, typ: 'data-export' }),
      );
    });
  });
});
