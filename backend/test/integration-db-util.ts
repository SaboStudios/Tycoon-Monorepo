// Integration test setup for parallel DB isolation
// This file provides a helper to create a unique schema per test worker
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

export async function createIsolatedDataSource(baseOptions: any) {
  const schema = `test_schema_${uuidv4().replace(/-/g, '')}`;
  const options = {
    ...baseOptions,
    schema,
    synchronize: true,
    dropSchema: true,
  };
  const dataSource = new DataSource(options);
  await dataSource.initialize();
  return { dataSource, schema };
}
