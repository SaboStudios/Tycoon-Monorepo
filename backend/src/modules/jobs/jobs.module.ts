import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SampleProcessor } from './processors/sample.processor';
import { JobsMetricsService } from './jobs-metrics.service';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [
    MetricsModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisConfig = configService.get('redis');
        return {
          connection: {
            host: redisConfig.host,
            port: redisConfig.port,
            password: redisConfig.password,
          },
        };
      },
    }),
    BullModule.registerQueue({
      name: 'background-jobs',
    }),
  ],
  providers: [SampleProcessor, JobsMetricsService],
  exports: [BullModule],
})
export class JobsModule {}
