import * as fs from 'fs';
import * as path from 'path';

import { AppDataSource } from './data-source';

const migrationsDir = path.join(__dirname, 'migrations');

function getMigrationFiles(): string[] {
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts') && !file.endsWith('.d.ts'));
}

function getRegisteredMigrationNames(): string[] {
  const migrations = (AppDataSource.options.migrations as unknown[]) ?? [];
  return migrations.map((migration) => (migration as { name: string }).name).sort();
}

function getExportedMigrationNames(): string[] {
  const names: string[] = [];
  for (const file of getMigrationFiles()) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const moduleExports = require(path.join(migrationsDir, file));
    for (const exported of Object.values(moduleExports)) {
      if (typeof exported === 'function' && exported.name) {
        names.push(exported.name);
      }
    }
  }
  return names.sort();
}

describe('AppDataSource migrations registration', () => {
  it('registers every migration file on disk', () => {
    const registered = getRegisteredMigrationNames();
    const onDisk = getExportedMigrationNames();

    const missingFromDataSource = onDisk.filter((name) => !registered.includes(name));
    expect(missingFromDataSource).toEqual([]);
  });

  it('has a migration file for every registered migration', () => {
    const registered = getRegisteredMigrationNames();
    const onDisk = getExportedMigrationNames();

    const missingFromDisk = registered.filter((name) => !onDisk.includes(name));
    expect(missingFromDisk).toEqual([]);
  });

  it('keeps the registered migration set in sync with the migrations directory', () => {
    expect(getRegisteredMigrationNames()).toEqual(getExportedMigrationNames());
  });
});
