import { BadRequestException } from '@nestjs/common';
import { CsvWaitlistRowDto } from '../dto/bulk-import-waitlist.dto';

/**
 * Accepted CSV column headers (case-insensitive, trimmed).
 * Maps common header variations to internal field names.
 */
const HEADER_MAP: Record<string, keyof CsvWaitlistRowDto> = {
  wallet_address: 'wallet_address',
  walletaddress: 'wallet_address',
  wallet: 'wallet_address',
  email_address: 'email_address',
  emailaddress: 'email_address',
  email: 'email_address',
  telegram_username: 'telegram_username',
  telegramusername: 'telegram_username',
  telegram: 'telegram_username',
};

/**
 * Lightweight CSV parser tailored for waitlist bulk import.
 *
 * - First row must be the header row.
 * - Supports comma (`,`) as delimiter.
 * - Blank rows are silently skipped.
 * - At least one recognised column must be present in the header.
 * - Enforces byte size and row count limits early in the pipeline.
 *
 * @param buffer - File buffer to parse
 * @param maxBytes - Maximum allowed file size in bytes (optional)
 * @param maxRows - Maximum allowed data rows (optional)
 * @returns An array of parsed row objects.
 * @throws BadRequestException if limits are exceeded or file is malformed
 */
export function parseCsv(
  buffer: Buffer,
  maxBytes?: number,
  maxRows?: number,
): CsvWaitlistRowDto[] {
  // Check byte size limit early
  if (maxBytes && buffer.length > maxBytes) {
    throw new BadRequestException(
      `CSV file exceeds maximum size of ${maxBytes} bytes (received ${buffer.length} bytes).`,
    );
  }

  const content = buffer
    .toString('utf-8')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  const lines = content.split('\n');

  if (lines.length < 2) {
    throw new BadRequestException(
      'CSV file must contain a header row and at least one data row.',
    );
  }

  // --- Parse header -----------------------------------------------------------
  const rawHeaders = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const columnMapping: (keyof CsvWaitlistRowDto | null)[] = rawHeaders.map(
    (h) => HEADER_MAP[h] ?? null,
  );

  const recognisedCount = columnMapping.filter(Boolean).length;
  if (recognisedCount === 0) {
    throw new BadRequestException(
      'CSV header must contain at least one of: wallet_address, email_address, telegram_username.',
    );
  }

  // --- Parse data rows --------------------------------------------------------
  const rows: CsvWaitlistRowDto[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length === 0) continue; // skip blank lines

    // Check row count limit before adding
    if (maxRows && rows.length >= maxRows) {
      throw new BadRequestException(
        `CSV file exceeds maximum row count of ${maxRows} (received more than ${maxRows} data rows).`,
      );
    }

    const values = line.split(',').map((v) => v.trim());
    const row: CsvWaitlistRowDto = {};

    for (let col = 0; col < columnMapping.length; col++) {
      const field = columnMapping[col];
      if (!field) continue;

      const value = values[col]?.trim();
      if (value && value.length > 0) {
        row[field] = value.toLowerCase();
      }
    }

    // Only include rows that have at least one non-empty field
    if (row.wallet_address || row.email_address || row.telegram_username) {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    throw new BadRequestException('CSV file contains no valid data rows.');
  }

  return rows;
}
