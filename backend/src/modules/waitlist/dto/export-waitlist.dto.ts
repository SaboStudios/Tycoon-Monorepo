import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { WaitlistPaginationDto } from './waitlist-pagination.dto';
import { WaitlistExportFormat } from '../enums/waitlist-export-format.enum';

export class ExportWaitlistDto extends WaitlistPaginationDto {
  @ApiPropertyOptional({
    description: 'Format of the export (csv or excel)',
    enum: WaitlistExportFormat,
    default: WaitlistExportFormat.CSV,
  })
  @IsOptional()
  @IsEnum(WaitlistExportFormat)
  format?: WaitlistExportFormat = WaitlistExportFormat.CSV;
}
