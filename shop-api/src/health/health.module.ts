import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { HealthProbesService } from './health-probes.service';

/**
 * Exposes liveness (/health) and readiness (/ready) probes.
 *
 * TypeOrmModule is imported so the DataSource token is available for injection
 * in HealthController, enabling the Postgres SELECT 1 readiness check
 * (issue #1934).
 */
@Module({
  imports: [TypeOrmModule.forFeature([])],
  controllers: [HealthController],
  providers: [HealthProbesService],
  exports: [HealthProbesService],
})
export class HealthModule {}
