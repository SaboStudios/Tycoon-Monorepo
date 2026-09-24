import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { VirusScanService } from './virus-scan.service';
import { MulterExceptionFilter } from './multer-exception.filter';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cs: ConfigService) => ({
        secret: cs.get<string>('jwt.secret'),
      }),
    }),
  ],
  controllers: [UploadsController],
  providers: [
    UploadsService,
    VirusScanService,
    {
      provide: APP_FILTER,
      useClass: MulterExceptionFilter,
    },
  ],
  exports: [UploadsService],
})
export class UploadsModule {}
