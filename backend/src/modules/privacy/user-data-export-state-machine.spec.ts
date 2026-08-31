import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { UserDataExportService } from './user-data-export.service';
import { UserDataExportProcessor } from './user-data-export.processor';
import { UserDataCollectorService } from './user-data-collector.service';
import { UserDataExportJob } from './entities/user-data-export-job.entity';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

const mockQueue = {
  add: jest.fn().mockResolvedValue({ id: 'bull-job-1' }),
};

const makeJob = (overrides: Partial<UserDataExportJob> = {}): UserDataExportJob =>
  ({
    id: 1,
    userId: 42,
    status: 'queued',
    filePath: null,
    errorMessage: null,
    startedAt: null,
    completedAt: null,
    expiresAt: null,
    createdAt: new Date(),
    ...overrides,
  }) as UserDataExportJob;

const mockJobsRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
};

describe('UserDataExportService – state machine (#1292)', () => {
  let service: UserDataExportService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockJobsRepo.create.mockImplementation((data) => ({ ...data, id: 1 }));
    mockJobsRepo.save.mockImplementation((obj) => Promise.resolve(obj));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserDataExportService,
        { provide: 'BullQueue_user-data', useValue: mockQueue },
        { provide: getRepositoryToken(UserDataExportJob), useValue: mockJobsRepo },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(null) },
        },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('mock-token') },
        },
      ],
    }).compile();

    service = module.get<UserDataExportService>(UserDataExportService);
  });

  it('requestExport creates job with status "queued"', async () => {
    const result = await service.requestExport(42);

    expect(mockJobsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 42, status: 'queued' }),
    );
    expect(result).toHaveProperty('jobId');
    expect(mockQueue.add).toHaveBeenCalledWith(
      'export-user-data',
      expect.objectContaining({ userId: 42 }),
      expect.any(Object),
    );
  });

  it('getStatus returns queued status without downloadUrl', async () => {
    mockJobsRepo.findOne.mockResolvedValue(makeJob({ status: 'queued' }));

    const res = await service.getStatus(42, 1);

    expect(res.status).toBe('queued');
    expect(res.downloadUrl).toBeUndefined();
  });

  it('getStatus returns running status without downloadUrl', async () => {
    mockJobsRepo.findOne.mockResolvedValue(
      makeJob({ status: 'running', startedAt: new Date() }),
    );

    const res = await service.getStatus(42, 1);

    expect(res.status).toBe('running');
    expect(res.downloadUrl).toBeUndefined();
  });

  it('getStatus returns failed status with errorMessage', async () => {
    mockJobsRepo.findOne.mockResolvedValue(
      makeJob({ status: 'failed', errorMessage: 'collector error' }),
    );

    const res = await service.getStatus(42, 1);

    expect(res.status).toBe('failed');
    expect(res.errorMessage).toBe('collector error');
    expect(res.downloadUrl).toBeUndefined();
  });

  it('getStatus returns downloadUrl when status is "done"', async () => {
    mockJobsRepo.findOne.mockResolvedValue(
      makeJob({
        status: 'done',
        filePath: '/storage/exports/42/export-1.json',
        completedAt: new Date(),
        expiresAt: new Date(Date.now() + 86_400_000),
      }),
    );

    const res = await service.getStatus(42, 1);

    expect(res.status).toBe('done');
    expect(res.downloadUrl).toContain('token=');
  });

  it('throws NotFoundException for unknown job', async () => {
    mockJobsRepo.findOne.mockResolvedValue(null);

    await expect(service.getStatus(42, 999)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('UserDataExportProcessor – state transitions (#1292)', () => {
  let processor: UserDataExportProcessor;
  const mockJobsRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockCollector = {
    buildExportPayload: jest.fn().mockResolvedValue({ tables: {}, user_id: 42 }),
  };

  const mockConfig = {
    get: jest.fn((key: string) => {
      if (key === 'app.dataExportTtlHours') return 24;
      if (key === 'app.dataExportDir') return '/tmp/test-exports';
      return null;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockJobsRepo.save.mockImplementation((obj) => Promise.resolve(obj));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserDataExportProcessor,
        { provide: getRepositoryToken(UserDataExportJob), useValue: mockJobsRepo },
        { provide: UserDataCollectorService, useValue: mockCollector },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    processor = module.get<UserDataExportProcessor>(UserDataExportProcessor);
  });

  it('transitions queued → running → done on success', async () => {
    const row = {
      id: 1,
      userId: 42,
      status: 'queued',
      filePath: null,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      expiresAt: null,
    };
    mockJobsRepo.findOne.mockResolvedValue(row);

    const statuses: string[] = [];
    mockJobsRepo.save.mockImplementation((obj) => {
      statuses.push(obj.status);
      return Promise.resolve(obj);
    });

    await processor.process({
      name: 'export-user-data',
      data: { jobId: 1, userId: 42 },
    } as any);

    expect(statuses[0]).toBe('running');
    expect(statuses[statuses.length - 1]).toBe('done');
  });

  it('transitions queued → running → failed on collector error', async () => {
    const row = {
      id: 1,
      userId: 42,
      status: 'queued',
      filePath: null,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      expiresAt: null,
    };
    mockJobsRepo.findOne.mockResolvedValue(row);
    mockCollector.buildExportPayload.mockRejectedValueOnce(new Error('db down'));

    const statuses: string[] = [];
    mockJobsRepo.save.mockImplementation((obj) => {
      statuses.push(obj.status);
      return Promise.resolve(obj);
    });

    await processor.process({
      name: 'export-user-data',
      data: { jobId: 1, userId: 42 },
    } as any);

    expect(statuses[0]).toBe('running');
    expect(statuses[statuses.length - 1]).toBe('failed');
    expect(row.errorMessage).toBe('db down');
  });

  it('logs do not contain userId PII on failure', async () => {
    const row = {
      id: 7,
      userId: 99,
      status: 'queued',
      filePath: null,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      expiresAt: null,
    };
    mockJobsRepo.findOne.mockResolvedValue(row);
    mockCollector.buildExportPayload.mockRejectedValueOnce(new Error('oops'));

    const logSpy = jest.spyOn((processor as any).logger, 'error');

    await processor.process({
      name: 'export-user-data',
      data: { jobId: 7, userId: 99 },
    } as any);

    const loggedMessages = logSpy.mock.calls.map((c) => String(c[0]));
    loggedMessages.forEach((msg) => {
      expect(msg).not.toContain('99');
    });
  });

  it('skips jobs with unknown name', async () => {
    await processor.process({
      name: 'unknown-job',
      data: { jobId: 1, userId: 42 },
    } as any);

    expect(mockJobsRepo.findOne).not.toHaveBeenCalled();
  });
});
