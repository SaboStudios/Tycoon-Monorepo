import { DataSource } from 'typeorm';
import { Response } from 'express';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let dataSource: { isInitialized: boolean; query: jest.Mock };
  let controller: HealthController;

  beforeEach(() => {
    // Build the controller directly with a stubbed DataSource — the
    // controller has no other dependencies.
    dataSource = {
      isInitialized: true,
      query: jest.fn(),
    } as unknown as { isInitialized: boolean; query: jest.Mock };
    controller = new HealthController(dataSource as unknown as DataSource);
  });

  const fakeResponse = () => {
    const json = jest.fn();
    const res = {
      status: jest.fn().mockReturnThis(),
      json,
    } as unknown as Response;
    return { res, json };
  };

  describe('liveness', () => {
    it('returns status ok with a numeric uptime and a parseable ISO timestamp', () => {
      const result = controller.liveness();

      expect(result.status).toBe('ok');
      expect(typeof result.uptime).toBe('number');
      expect(Number.isFinite(result.uptime)).toBe(true);
      expect(Date.parse(result.timestamp)).not.toBeNaN();
    });
  });

  describe('readiness', () => {
    it('calls res.status(200) with database up when the data source resolves', async () => {
      dataSource.isInitialized = true;
      dataSource.query.mockResolvedValue([1]);

      const { res, json } = fakeResponse();
      await controller.readiness(res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ok',
          database: 'up',
          timestamp: expect.any(String),
        }),
      );
      expect(Date.parse(json.mock.calls[0][0].timestamp)).not.toBeNaN();
    });

    it('calls res.status(503) with database down when the data source rejects, without throwing', async () => {
      dataSource.isInitialized = false;
      dataSource.query.mockRejectedValue(new Error('connection refused'));

      const { res, json } = fakeResponse();
      await expect(controller.readiness(res)).resolves.not.toThrow();

      expect(res.status).toHaveBeenCalledWith(503);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          database: 'down',
          timestamp: expect.any(String),
        }),
      );
    });

    it('never includes connection strings, credentials or PII in either response', async () => {
      for (const initialized of [true, false]) {
        dataSource.isInitialized = initialized;

        const { res, json } = fakeResponse();
        await controller.readiness(res);

        const body = JSON.stringify(json.mock.calls[0][0]);
        expect(body).not.toMatch(
          /host|user|password|connection string|SELECT 1/i,
        );
      }
    });
  });
});
