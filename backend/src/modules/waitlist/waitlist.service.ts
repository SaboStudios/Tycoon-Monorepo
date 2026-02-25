import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as express from 'express';
import * as fastcsv from 'fast-csv';
import * as ExcelJS from 'exceljs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { Waitlist } from './entities/waitlist.entity';
import { CreateWaitlistDto } from './dto/create-waitlist.dto';
import { WaitlistResponseDto } from './dto/waitlist-response.dto';
import { WaitlistPaginationDto } from './dto/waitlist-pagination.dto';
import { ExportWaitlistDto } from './dto/export-waitlist.dto';
import { WaitlistExportFormat } from './enums/waitlist-export-format.enum';
import {
  BulkImportErrorDto,
  BulkImportResponseDto,
  CsvWaitlistRowDto,
} from './dto/bulk-import-waitlist.dto';
import { parseCsv } from './utils/csv-parser.util';
import { PaginationService, PaginatedResponse, SortOrder } from '../../common';

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(
    @InjectRepository(Waitlist)
    private readonly waitlistRepository: Repository<Waitlist>,
    private readonly paginationService: PaginationService,
  ) {}

  /**
   * Register a new waitlist entry.
   * Validates at least one identifier is provided, checks per-field
   * uniqueness with precise error messages, then persists the entry.
   */
  async create(dto: CreateWaitlistDto): Promise<WaitlistResponseDto> {
    const { wallet_address, email_address, telegram_username } = dto;

    // Service-level guard (belt-and-suspenders after DTO validation)
    if (!wallet_address && !email_address && !telegram_username) {
      throw new BadRequestException(
        'At least one of wallet_address, email_address, or telegram_username is required.',
      );
    }

    // Per-field duplicate checks — gives specific, user-friendly error messages
    if (wallet_address) {
      const existing = await this.waitlistRepository.findOne({
        where: { wallet_address },
      });
      if (existing) {
        throw new ConflictException(
          'This wallet address is already on the waitlist.',
        );
      }
    }

    if (email_address) {
      const existing = await this.waitlistRepository.findOne({
        where: { email_address },
      });
      if (existing) {
        throw new ConflictException(
          'This email address is already on the waitlist.',
        );
      }
    }

    try {
      const entry = this.waitlistRepository.create(dto);
      const saved = await this.waitlistRepository.save(entry);
      return this.toResponseDto(saved);
    } catch (error: unknown) {
      const dbError = error as { code?: string };
      // Fallback: catch any remaining unique constraint violations
      if (dbError.code === '23505') {
        throw new ConflictException(
          'This entry is already registered on the waitlist.',
        );
      }
      throw new InternalServerErrorException(
        'Failed to register for the waitlist. Please try again.',
      );
    }
  }

  async findAll(): Promise<Waitlist[]> {
    return this.waitlistRepository.find({
      order: { created_at: SortOrder.DESC },
    });
  }

  /**
   * Get all waitlist entries with pagination, sorting and filtering for admin.
   */
  async findAllAdmin(
    paginationDto: WaitlistPaginationDto,
  ): Promise<PaginatedResponse<Waitlist>> {
    const { wallet, email, telegram, sortBy, sortOrder } = paginationDto;

    const queryBuilder = this.waitlistRepository.createQueryBuilder('waitlist');

    // Apply filters
    if (wallet) {
      queryBuilder.andWhere('waitlist.wallet_address ILIKE :wallet', {
        wallet: `%${wallet}%`,
      });
    }
    if (email) {
      queryBuilder.andWhere('waitlist.email_address ILIKE :email', {
        email: `%${email}%`,
      });
    }
    if (telegram) {
      queryBuilder.andWhere('waitlist.telegram_username ILIKE :telegram', {
        telegram: `%${telegram}%`,
      });
    }

    // Apply specific sorting logic if requested
    if (sortBy === 'newest') {
      queryBuilder.orderBy('waitlist.created_at', sortOrder || SortOrder.DESC);
    } else if (sortBy === 'wallet') {
      queryBuilder.orderBy(
        'waitlist.wallet_address',
        sortOrder || SortOrder.ASC,
      );
    } else if (sortBy === 'email') {
      queryBuilder.orderBy(
        'waitlist.email_address',
        sortOrder || SortOrder.ASC,
      );
    } else if (sortBy) {
      // Default to entity field sorting if it's a valid field
      queryBuilder.orderBy(`waitlist.${sortBy}`, sortOrder || SortOrder.ASC);
    } else {
      // Default sort
      queryBuilder.orderBy('waitlist.created_at', SortOrder.DESC);
    }

    return await this.paginationService.paginate(queryBuilder, paginationDto);
  }

  /**
   * Export waitlist entries as CSV or Excel with streaming support.
   */
  async exportWaitlist(
    dto: ExportWaitlistDto,
    res: express.Response,
  ): Promise<void> {
    const { format, wallet, email, telegram, sortBy, sortOrder } = dto;

    const queryBuilder = this.waitlistRepository.createQueryBuilder('waitlist');

    // Apply same filters as findAllAdmin
    if (wallet) {
      queryBuilder.andWhere('waitlist.wallet_address ILIKE :wallet', {
        wallet: `%${wallet}%`,
      });
    }
    if (email) {
      queryBuilder.andWhere('waitlist.email_address ILIKE :email', {
        email: `%${email}%`,
      });
    }
    if (telegram) {
      queryBuilder.andWhere('waitlist.telegram_username ILIKE :telegram', {
        telegram: `%${telegram}%`,
      });
    }

    // Apply sorting
    if (sortBy === 'newest') {
      queryBuilder.orderBy('waitlist.created_at', sortOrder || SortOrder.DESC);
    } else if (sortBy === 'wallet') {
      queryBuilder.orderBy(
        'waitlist.wallet_address',
        sortOrder || SortOrder.ASC,
      );
    } else if (sortBy === 'email') {
      queryBuilder.orderBy(
        'waitlist.email_address',
        sortOrder || SortOrder.ASC,
      );
    } else if (sortBy) {
      queryBuilder.orderBy(`waitlist.${sortBy}`, sortOrder || SortOrder.ASC);
    } else {
      queryBuilder.orderBy('waitlist.created_at', SortOrder.DESC);
    }

    const filename = `waitlist_export_${new Date().getTime()}`;

    interface WaitlistStreamRow {
      waitlist_id: number;
      waitlist_wallet_address: string | null;
      waitlist_email_address: string | null;
      waitlist_telegram_username: string | null;
      waitlist_created_at: Date;
    }

    if (format === WaitlistExportFormat.EXCEL) {
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=${filename}.xlsx`,
      );

      const options = {
        stream: res,
        useStyles: true,
        useSharedStrings: true,
      };

      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter(options);
      const worksheet = workbook.addWorksheet('Waitlist');

      worksheet.columns = [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Wallet Address', key: 'wallet_address', width: 45 },
        { header: 'Email Address', key: 'email_address', width: 35 },
        { header: 'Telegram Username', key: 'telegram_username', width: 25 },
        { header: 'Created At', key: 'created_at', width: 25 },
      ];

      const stream = await queryBuilder.stream();
      for await (const row of stream) {
        const data = row as WaitlistStreamRow;
        // TypeORM stream returns raw data with aliases like 'waitlist_id'
        worksheet
          .addRow({
            id: data.waitlist_id,
            wallet_address: data.waitlist_wallet_address,
            email_address: data.waitlist_email_address,
            telegram_username: data.waitlist_telegram_username,
            created_at: data.waitlist_created_at,
          })
          .commit();
      }

      await workbook.commit();
    } else {
      // Default to CSV
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=${filename}.csv`,
      );

      const csvStream = fastcsv.format({ headers: true });
      csvStream.pipe(res);

      const stream = await queryBuilder.stream();
      for await (const row of stream) {
        const data = row as WaitlistStreamRow;
        csvStream.write({
          ID: data.waitlist_id,
          'Wallet Address': data.waitlist_wallet_address,
          'Email Address': data.waitlist_email_address,
          'Telegram Username': data.waitlist_telegram_username,
          'Created At': data.waitlist_created_at,
        });
      }

      csvStream.end();
    }
  }

  /**
   * Get aggregate statistics for the waitlist.
   */
  async getStats() {
    const total = await this.waitlistRepository.count();
    const withWallet = await this.waitlistRepository.count({
      where: { wallet_address: Not(IsNull()) },
    });
    const withEmail = await this.waitlistRepository.count({
      where: { email_address: Not(IsNull()) },
    });

    return {
      totalItems: total,
      withWallet,
      withEmail,
    };
  }

  /**
   * Bulk-import waitlist entries from an uploaded CSV file buffer.
   *
   * Processing strategy (handles large files efficiently):
   *   1. Parse CSV into rows
   *   2. Pre-fetch existing wallet/email values in bulk (single query)
   *   3. Walk rows, skipping duplicates and collecting validation errors
   *   4. Batch-insert valid entries in chunks of BATCH_SIZE
   *   5. Return a comprehensive result / error report
   */
  async bulkImport(fileBuffer: Buffer): Promise<BulkImportResponseDto> {
    const BATCH_SIZE = 100;
    const rows = parseCsv(fileBuffer);
    const totalRows = rows.length;
    const errors: BulkImportErrorDto[] = [];

    // --- Pre-fetch existing identifiers for deduplication ----------------
    const existingWallets = new Set<string>();
    const existingEmails = new Set<string>();

    const allEntries = await this.waitlistRepository.find({
      select: ['wallet_address', 'email_address'],
    });

    for (const entry of allEntries) {
      if (entry.wallet_address) existingWallets.add(entry.wallet_address);
      if (entry.email_address) existingEmails.add(entry.email_address);
    }

    // Track identifiers seen within this import to avoid intra-file dupes
    const seenWallets = new Set<string>();
    const seenEmails = new Set<string>();

    // --- Validate and deduplicate rows -----------------------------------
    const validRows: CsvWaitlistRowDto[] = [];
    let duplicateCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1; // 1-based for user-facing error report

      // Validate at least one field is present
      if (!row.wallet_address && !row.email_address && !row.telegram_username) {
        errors.push({
          row: rowNum,
          error:
            'Row must contain at least one of: wallet_address, email_address, telegram_username.',
        });
        continue;
      }

      // Validate email format (basic)
      if (
        row.email_address &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email_address)
      ) {
        errors.push({
          row: rowNum,
          error: `Invalid email format: ${row.email_address}`,
        });
        continue;
      }

      // Validate telegram username format
      if (row.telegram_username) {
        const tg = row.telegram_username.replace(/^@/, '');
        if (!/^[a-zA-Z0-9_]{1,100}$/.test(tg)) {
          errors.push({
            row: rowNum,
            error: `Invalid telegram username: ${row.telegram_username}`,
          });
          continue;
        }
        row.telegram_username = tg;
      }

      // Check duplicates against DB
      let isDuplicate = false;
      if (row.wallet_address && existingWallets.has(row.wallet_address)) {
        isDuplicate = true;
      }
      if (row.email_address && existingEmails.has(row.email_address)) {
        isDuplicate = true;
      }

      // Check duplicates within the CSV itself
      if (row.wallet_address && seenWallets.has(row.wallet_address)) {
        isDuplicate = true;
      }
      if (row.email_address && seenEmails.has(row.email_address)) {
        isDuplicate = true;
      }

      if (isDuplicate) {
        duplicateCount++;
        continue;
      }

      // Track for intra-file dedup
      if (row.wallet_address) seenWallets.add(row.wallet_address);
      if (row.email_address) seenEmails.add(row.email_address);

      validRows.push(row);
    }

    // --- Batch insert ----------------------------------------------------
    let importedCount = 0;

    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE);
      try {
        const entities = batch.map((row) =>
          this.waitlistRepository.create({
            wallet_address: row.wallet_address ?? undefined,
            email_address: row.email_address ?? undefined,
            telegram_username: row.telegram_username ?? undefined,
          }),
        );
        await this.waitlistRepository.save(entities);
        importedCount += batch.length;
      } catch {
        // If a batch fails, fall back to row-by-row insert for that batch
        for (let j = 0; j < batch.length; j++) {
          const row = batch[j];
          const rowNum = i + j + 1;
          try {
            const entity = this.waitlistRepository.create({
              wallet_address: row.wallet_address ?? undefined,
              email_address: row.email_address ?? undefined,
              telegram_username: row.telegram_username ?? undefined,
            });
            await this.waitlistRepository.save(entity);
            importedCount++;
          } catch (innerError: unknown) {
            const dbError = innerError as { code?: string };
            if (dbError.code === '23505') {
              duplicateCount++;
            } else {
              errors.push({
                row: rowNum,
                error: 'Failed to save entry. Please check the data.',
              });
            }
          }
        }
      }
    }

    this.logger.log(
      `Bulk import completed: ${importedCount} imported, ${duplicateCount} duplicates, ${errors.length} errors out of ${totalRows} rows.`,
    );

    return {
      message: 'Bulk import completed.',
      data: {
        totalRows,
        importedCount,
        duplicateCount,
        errorCount: errors.length,
        errors,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private toResponseDto(entry: Waitlist): WaitlistResponseDto {
    return {
      message: 'You have been added to the waitlist.',
      data: {
        wallet_address: entry.wallet_address ?? null,
        email_address: entry.email_address ?? null,
        telegram_username: entry.telegram_username ?? null,
        joined_at: entry.created_at,
      },
    };
  }
}
