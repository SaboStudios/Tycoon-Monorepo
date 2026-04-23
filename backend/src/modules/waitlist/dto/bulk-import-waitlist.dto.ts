import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO representing a single row parsed from a waitlist CSV file.
 * Mirrors the same fields as CreateWaitlistDto but used internally
 * for bulk processing — validation happens in the service layer.
 */
export class CsvWaitlistRowDto {
  wallet_address?: string;
  email_address?: string;
  telegram_username?: string;
}

/* ------------------------------------------------------------------ */
/*  Response DTOs                                                      */
/* ------------------------------------------------------------------ */

export class BulkImportErrorDto {
  @ApiProperty({
    example: 2,
    description: 'CSV row number (1-based, excluding header)',
  })
  row: number;

  @ApiProperty({ example: 'Duplicate email address: user@example.com' })
  error: string;
}

export class BulkImportResultDto {
  @ApiProperty({ example: 150, description: 'Total rows parsed from the CSV' })
  totalRows: number;

  @ApiProperty({ example: 142, description: 'Rows successfully imported' })
  importedCount: number;

  @ApiProperty({ example: 5, description: 'Rows skipped as duplicates' })
  duplicateCount: number;

  @ApiProperty({ example: 3, description: 'Rows that failed validation' })
  errorCount: number;

  @ApiProperty({
    type: [BulkImportErrorDto],
    description: 'Details of each failed row',
  })
  errors: BulkImportErrorDto[];
}

export class BulkImportResponseDto {
  @ApiProperty({ example: 'Bulk import completed.' })
  message: string;

  @ApiProperty({ type: BulkImportResultDto })
  data: BulkImportResultDto;
}
