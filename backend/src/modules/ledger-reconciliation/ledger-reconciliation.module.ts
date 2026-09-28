import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LedgerDiscrepancy } from './entities/ledger-discrepancy.entity';
import { LedgerReconciliationService } from './ledger-reconciliation.service';
import { LedgerReconciliationScheduler } from './ledger-reconciliation.scheduler';
import { LedgerReconciliationController } from './ledger-reconciliation.controller';
import { StubPaymentProviderClient } from './providers/stub-payment-provider.client';
import { Purchase } from '../shop/entities/purchase.entity';
import { AuditTrailModule } from '../audit-trail/audit-trail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LedgerDiscrepancy, Purchase]),
    AuditTrailModule,
  ],
  providers: [
    LedgerReconciliationService,
    LedgerReconciliationScheduler,
    {
      provide: 'IPaymentProviderClient',
      useClass: StubPaymentProviderClient,
    },
    // Re-export the stub as the concrete token the service injects
    StubPaymentProviderClient,
  ],
  controllers: [LedgerReconciliationController],
  exports: [LedgerReconciliationService],
})
export class LedgerReconciliationModule {}