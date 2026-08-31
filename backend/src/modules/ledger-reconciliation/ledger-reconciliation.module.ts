import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LedgerDiscrepancy } from './entities/ledger-discrepancy.entity';
import { LedgerReconciliationService } from './ledger-reconciliation.service';
import { LedgerReconciliationScheduler } from './ledger-reconciliation.scheduler';
import { LedgerReconciliationController } from './ledger-reconciliation.controller';
import { LedgerReconciliationObservabilityService } from './ledger-reconciliation-observability.service';
import { StubPaymentProviderClient } from './providers/stub-payment-provider.client';
import { Purchase } from '../shop/entities/purchase.entity';
import { ConfigService } from '@nestjs/config';
import { StripePaymentProviderClient } from './providers/stripe-payment-provider.client';

@Module({
  imports: [TypeOrmModule.forFeature([LedgerDiscrepancy, Purchase])],
  providers: [
    LedgerReconciliationService,
    LedgerReconciliationScheduler,
    LedgerReconciliationObservabilityService,
    StubPaymentProviderClient,
    StripePaymentProviderClient,
    {
      provide: 'IPaymentProviderClient',
      inject: [ConfigService, StubPaymentProviderClient, StripePaymentProviderClient],
      useFactory: (
        config: ConfigService,
        stub: StubPaymentProviderClient,
        stripe: StripePaymentProviderClient,
      ) => {
        const provider = config.get<string>('PAYMENT_PROVIDER', 'stub');
        if (provider === 'stripe') return stripe;
        if (provider === 'stub') return stub;
        throw new Error(`Unsupported PAYMENT_PROVIDER: ${provider}`);
      },
    },
  ],
  controllers: [LedgerReconciliationController],
  exports: [LedgerReconciliationService],
})
export class LedgerReconciliationModule {}
