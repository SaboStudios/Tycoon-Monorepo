import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuditTrailService } from '../../audit/audit-trail.service';
import { LedgerService } from './ledger.service';

/**
 * Explicit, PII-minimized column allowlist for the admin ledger CSV export.
 * Only these columns may ever be emitted. Raw PII (email, wallet address,
 * display name, IP, tokens) is intentionally excluded; identifiers are
 * pseudonymized via the ledger entry id only.
 */
export const LEDGER_EXPORT_COLUMNS = [
  'entryId',
  'createdAt',
  'type',
  'direction',
  'amount',
  'currency',
  'status',
  'reference',
] as const;

export type LedgerExportColumn = (typeof LEDGER_EXPORT_COLUMNS)[number];

/** Hard cap on rows per export to prevent export DoS on large ranges. */
export const LEDGER_EXPORT_MAX_ROWS = 10_000;

/** Hard cap on the requested time range (in days) to prevent export DoS. */
export const LEDGER_EXPORT_MAX_RANGE_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  // Neutralize spreadsheet formula injection and escape quotes/commas/newlines.
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

@Controller('admin/ledger')
@UseGuards(JwtAuthGuard, AdminGuard)
export class LedgerController {
  private readonly logger = new Logger(LedgerController.name);

  constructor(
    private readonly ledgerService: LedgerService,
    private readonly auditTrail: AuditTrailService,
  ) {}

  @Get('export')
  async exportCsv(
    @CurrentUser('id') adminId: string,
    @Res({ passthrough: true }) res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('type') type?: string,
  ): Promise<string> {
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from ? new Date(from) : new Date(toDate.getTime() - 30 * DAY_MS);

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new BadRequestException('Invalid from/to date');
    }
    if (fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException('from must be before to');
    }
    if (toDate.getTime() - fromDate.getTime() > LEDGER_EXPORT_MAX_RANGE_DAYS * DAY_MS) {
      throw new BadRequestException(
        `Export range exceeds maximum of ${LEDGER_EXPORT_MAX_RANGE_DAYS} days`,
      );
    }

    const rows = await this.ledgerService.findForExport({
      from: fromDate,
      to: toDate,
      type,
      limit: LEDGER_EXPORT_MAX_ROWS,
    });

    // Audit who exported and what range, regardless of row count.
    await this.auditTrail.record({
      actorId: adminId,
      action: 'admin.ledger.export',
      target: 'ledger',
      metadata: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        type: type ?? null,
        rowCount: rows.length,
        columns: LEDGER_EXPORT_COLUMNS,
      },
    });

    const header = LEDGER_EXPORT_COLUMNS.join(',');
    const body = rows
      .map((row) =>
        LEDGER_EXPORT_COLUMNS.map((col) => csvEscape(row[col])).join(','),
      )
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ledger-export-${fromDate.toISOString().slice(0, 10)}_${toDate
        .toISOString()
        .slice(0, 10)}.csv"`,
    );

    return `${header}\n${body}`;
  }
}
