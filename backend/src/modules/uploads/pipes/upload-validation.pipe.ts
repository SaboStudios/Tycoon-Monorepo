import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { validate, ValidationError } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UploadsErrorMapperService } from '../uploads-error-mapper.service';

/**
 * Enhanced validation pipe for upload DTOs
 * Provides detailed validation error messages using the error mapper
 */
@Injectable()
export class UploadValidationPipe implements PipeTransform<any> {
  constructor(private readonly errorMapper: UploadsErrorMapperService) {}

  async transform(value: any, metadata: ArgumentMetadata) {
    if (!metadata.metatype || !this.toValidate(metadata.metatype)) {
      return value;
    }

    const object = plainToInstance(metadata.metatype, value);
    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    });

    if (errors.length > 0) {
      const mappedError = this.errorMapper.mapValidationErrors(errors);
      throw new BadRequestException(mappedError);
    }

    return object;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}
