import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { VirusScanService } from './virus-scan.service';
import { MulterExceptionFilter } from './multer-exception.filter';
import { UploadsObservabilityService } from './uploads-observability.service';
import { UploadsObservabilityInterceptor } from './uploads-observability.interceptor';
import { UploadsErrorMapperService } from './uploads-error-mapper.service';
import { UploadValidationPipe } from './pipes/upload-validation.pipe';
import { UploadExceptionFilter } from './filters/upload-exception.filter';
import { AuthModule } from '../auth/auth.module';
import { Upload } from './entities/upload.entity';
import { AuditTrailModule } from '../audit-trail/audit-trail.module';

@Module({
  imports: [
    AuthModule,
    ConfigModule,
    AuditTrailModule,
    TypeOrmModule.forFeature([Upload]),
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
    UploadsObservabilityService,
    UploadsObservabilityInterceptor,
    UploadsErrorMapperService,
    UploadValidationPipe,
    UploadsService,
    VirusScanService,
    {
      provide: APP_FILTER,
      useClass: MulterExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: UploadExceptionFilter,
    },
  ],
  exports: [UploadsService, UploadsObservabilityService, UploadsErrorMapperService],
})
export class UploadsModule { }

