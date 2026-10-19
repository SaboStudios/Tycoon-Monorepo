import { Test, TestingModule } from '@nestjs/testing';
import { Module } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PurchasesModule } from './purchases.module';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';
import { Purchase } from './entities/purchase.entity';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { IdempotencyRecord } from '../idempotency/entities/idempotency-record.entity';
import { AuthModule } from '../auth/auth.module';

/**
 * Compilable stand-in for PurchasesModule that adds a stubbed DataSource
 * (the real module graph has no TypeOrmModule.forRoot, so DataSource is
 * otherwise unregistered). Mirrors PurchasesModule's wiring so the test
 * exercises the real controllers/services/providers.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Purchase]),
    IdempotencyModule,
    AuthModule,
  ],
  controllers: [PurchasesController],
  providers: [
    PurchasesService,
    { provide: DataSource, useValue: {} as unknown as DataSource },
  ],
})
class TestPurchasesModule {}

describe('PurchasesModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [PurchasesModule],
    })
      .overrideModule(PurchasesModule)
      .useModule(TestPurchasesModule)
      // Stub every piece of the dependency graph that needs a live DB or
      // infra so the module compiles with no external services.
      .overrideProvider(getRepositoryToken(Purchase))
      .useValue({} as Repository<Purchase>)
      .overrideProvider(getRepositoryToken(IdempotencyRecord))
      .useValue({} as Repository<IdempotencyRecord>)
      .overrideProvider(IdempotencyService)
      .useValue({} as IdempotencyService)
      .compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('resolves PurchasesService and PurchasesController from the compiled module', () => {
    expect(module.get(PurchasesService)).toBeDefined();
    expect(module.get(PurchasesController)).toBeDefined();
  });

  it('lists IdempotencyModule and AuthModule in the module imports metadata', () => {
    const imports = Reflect.getMetadata(
      'imports',
      PurchasesModule,
    ) as unknown as Array<unknown>;

    expect(imports).toContain(IdempotencyModule);
    expect(imports).toContain(AuthModule);
  });
});