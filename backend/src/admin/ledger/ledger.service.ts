import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere } from 'typeorm';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { AuditTrailService } from '../audit/audit-trail.service';

/**
 * Explicit, PII-minimized column allowlist for admin ledger CSV exports.
 *
 * Only these columns may ever be serialized into an export. Raw PII
 * (email, wallet address, display name, IP, etc.) is intentionally excluded;
 * the opaque `playerRef` is a non-reversible reference suitable for support
 * reconciliation without leaking identity. See
 * backend/docs/privacy/DATA_CATEGORIES.md.
 */
export const LEDGER_EXPORT_COLUMNS = [
  'id',
  'playerRef',
  'type',
  'amount',
  'currency',
  'status',
  'reference',
  'createdAt',
] as const;

export type LedgerExportColumn = (typeof LEDGER_EXPORT_COLUMNS)[number];

/** Hard cap on rows per export to prevent export DoS on large ranges. */
export const LEDGER_EXPORT_MAX_ROWS = 10_000;

/** Hard cap on the requested time window (in days) for a single export. */
export const LEDGER_EXPORT_MAX_RANGE_DAYS = 90;

/** Default page size for paginated ledger queries. */
export const LEDGER_PAGE_DEFAULT_LIMIT = 50;

/** Hard cap on page size for paginated ledger queries. */
export const LEDGER_PAGE_MAX_LIMIT = 200;

export interface LedgerExportQuery {
  from?: string;
  to?: string;
  type?: string;
  status?: string;
}

export interface LedgerExportResult {
  filename: string;
  contentType: string;
  columns: LedgerExportColumn[];
  rowCount: number;
  csv: string;
}

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepository: Repository<LedgerEntry>,
    private readonly auditTrailService: AuditTrailService,
  ) {}

  /**
   * Paginated ledger query with a hard cap on page size.
   */
  async findPaginated(
    page = 1,
    limit = LEDGER_PAGE_DEFAULT_LIMIT,
    filters: { type?: string; status?: string } = {},
  ): Promise<{ items: LedgerEntry[]; total: number; page: number; limit: number }> {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeLimit = Math.min(
      Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : LEDGER_PAGE_DEFAULT_LIMIT,
      LEDGER_PAGE_MAX_LIMIT,
    );

    const where: FindOptionsWhere<LedgerEntry> = {};
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;

    const [items, total] = await this.ledgerRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });

    return { items, total, page: safePage, limit: safeLimit };
  }

  /**
   * Build a PII-minimized CSV export of the admin ledger.
   *
   * - Enforces an explicit column allowlist (LEDGER_EXPORT_COLUMNS).
   * - Caps the requested range (LEDGER_EXPORT_MAX_RANGE_DAYS) and row count
   *   (LEDGER_EXPORT_MAX_ROWS) to prevent export DoS.
   * - Writes an AuditTrail entry recording who exported and the exact range.
   */
  async exportCsv(
    query: LedgerExportQuery,
    actor: { id: string; role?: string },
  ): Promise<LedgerExportResult> {
    const { from, to } = this.parseAndValidateRange(query);

    const where: FindOptionsWhere<LedgerEntry> = {
      createdAt: Between(from, to),
    };
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;

    const rows = await this.ledgerRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: LEDGER_EXPORT_MAX_ROWS + 1,
    });

    if (rows.length > LEDGER_EXPORT_MAX_ROWS) {
      throw new BadRequestException(
        `Export range exceeds the maximum of ${LEDGER_EXPORT_MAX_ROWS} rows; narrow the range.`,
      );
    }

    const columns = [...LEDGER_EXPORT_COLUMNS];
    const csv = this.serializeCsv(rows, columns);

    // Audit who exported and what range, regardless of downstream delivery.
    await this.auditTrailService.record({
      action: 'admin.ledger.export',
      actorId: actor.id,
      actorRole: actor.role,
      target: 'ledger',
      metadata: {
        from: from.toISOString(),
        to: to.toISOString(),
        type: query.type ?? null,
        status: query.status ?? null,
        columns,
        rowCount: rows.length,
      },
    });

    const filename = `ledger-export-${from.toISOString().slice(0, 10)}_${to
      .toISOString()
      .slice(0, 10)}.csv`;

    return {
      filename,
      contentType: 'text/csv; charset=utf-8',
      columns,
      rowCount: rows.length,
      csv,
    };
  }

  private parseAndValidateRange(query: LedgerExportQuery): { from: Date; to: Date } {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - LEDGER_EXPORT_MAX_RANGE_DAYS * 24 * 60 * 60 * 1000);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Invalid export range: from/to must be valid ISO dates.');
    }
    if (from > to) {
      throw new BadRequestException('Invalid export range: from must be before to.');
    }

    const maxRangeMs = LEDGER_EXPORT_MAX_RANGE_DAYS * 24 * 60 * 60 * 1000;
    if (to.getTime() - from.getTime() > maxRangeMs) {
      throw new BadRequestException(
        `Export range exceeds the maximum of ${LEDGER_EXPORT_MAX_RANGE_DAYS} days.`,
      );
    }

    return { from, to };
  }

  private serializeCsv(rows: LedgerEntry[], columns: LedgerExportColumn[]): string {
    const header = columns.join(',');
    const lines = rows.map((row) =>
      columns.map((column) => this.escapeCsvValue(row[column])).join(','),
    );
    return [header, ...lines].join('\n');
  }

  private escapeCsvValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    const raw = value instanceof Date ? value.toISOString() : String(value);
    // Neutralize spreadsheet formula injection and quote when needed.
    const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
    if (/[",\n\r]/.test(safe)) {
      return `"${safe.replace(/"/g, '""')}"`;
    }
    return safe;
  }
}
