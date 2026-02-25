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
 *
 * @returns An array of parsed row objects.
 */
export function parseCsv(buffer: Buffer): CsvWaitlistRowDto[] {
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
