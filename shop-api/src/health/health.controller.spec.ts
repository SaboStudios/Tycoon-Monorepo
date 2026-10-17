import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let dataSource: { isInitialized: boolean };

  beforeEach(async () => {
    dataSource = { isInitialized: true };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('live', () => {
    it('returns 200 whenever the process is up', () => {
      expect(controller.live()).toEqual({ status: 'ok' });
    });
  });

  describe('ready', () => {
    it('returns 200 when the DataSource is initialized', () => {
      dataSource.isInitialized = true;

      expect(controller.ready()).toEqual({ status: 'ok' });
    });

    it('returns 503 when the DataSource is not initialized', () => {
      dataSource.isInitialized = false;

      expect(() => controller.ready()).toThrow(ServiceUnavailableException);
    });
  });
});
