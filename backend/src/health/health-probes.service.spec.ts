import { DatabaseHealthIndicator } from './health-probes.service';

describe('DatabaseHealthIndicator', () => {
  it('reports down with a distinguishing message when the DataSource is not initialized', async () => {
    const repo = { query: jest.fn() } as any;
    const dataSource = { isInitialized: false } as any;

    const indicator = new DatabaseHealthIndicator(repo, dataSource);
    const result = await indicator.isHealthy('database');

    expect(result.database.status).toBe('down');
    expect(result.database.message).toBe('DataSource is not initialized');
    expect(repo.query).not.toHaveBeenCalled();
  });

  it('reports down with the ping error message when the DataSource is initialized but the ping fails', async () => {
    const repo = { query: jest.fn().mockRejectedValue(new Error('connection refused')) } as any;
    const dataSource = { isInitialized: true } as any;

    const indicator = new DatabaseHealthIndicator(repo, dataSource);
    const result = await indicator.isHealthy('database');

    expect(result.database.status).toBe('down');
    expect(result.database.message).toBe('connection refused');
  });

  it('reports up when the DataSource is initialized and the ping succeeds', async () => {
    const repo = { query: jest.fn().mockResolvedValue([{ 1: 1 }]) } as any;
    const dataSource = { isInitialized: true } as any;

    const indicator = new DatabaseHealthIndicator(repo, dataSource);
    const result = await indicator.isHealthy('database');

    expect(result.database.status).toBe('up');
  });
});
