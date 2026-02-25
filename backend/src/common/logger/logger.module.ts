import { Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createWinstonConfig } from './logger.config';
import { LoggerService } from './logger.service';

/**
 * Logger Module
 * Provides Winston-based logging throughout the application
 */
@Module({
  imports: [
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const environment =
          configService.get<string>('app.environment') || 'development';
        return createWinstonConfig(environment);
      },
    }),
  ],
  providers: [LoggerService],
  exports: [LoggerService, WinstonModule],
})
export class LoggerModule {}
