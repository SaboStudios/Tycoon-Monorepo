import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { HealthProbesService } from './health-probes.service';

@Module({
  imports: [TypeOrmModule.forFeature([])],
  controllers: [HealthController],
  providers: [HealthProbesService],
  exports: [HealthProbesService],
})
export class HealthModule {}
