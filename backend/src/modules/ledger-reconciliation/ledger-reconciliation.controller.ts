import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { LedgerReconciliationService } from './ledger-reconciliation.service';
import {
  TriggerReconciliationDto,
  ResolveDiscrepancyDto,
} from './dto/reconciliation.dto';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/ledger-reconciliation')
export class LedgerReconciliationController {
  constructor(private readonly service: LedgerReconciliationService) {}

  /**
   * Manually trigger a reconciliation run.
   * Defaults to dry-run=true for safety.
   */
  @Post('run')
  async triggerRun(@Body() dto: TriggerReconciliationDto) {
    const dryRun = dto.dryRun !== false; // default true
    const endDate = dto.endDate ? new Date(dto.endDate) : new Date();
    const startDate = dto.startDate
      ? new Date(dto.startDate)
      : new Date(endDate.getTime() - 24 * 60 * 60 * 1000);

    return this.service.reconcile(startDate, endDate, dryRun);
  }

  /** List discrepancies, optionally filtered by runId */
  @Get('discrepancies')
  async listDiscrepancies(@Query('runId') runId?: string) {
    return this.service.findDiscrepancies(runId);
  }

  /** Mark a discrepancy as resolved with a note */
  @Patch('discrepancies/:id/resolve')
  async resolve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResolveDiscrepancyDto,
  ) {
    return this.service.resolveDiscrepancy(id, dto.resolutionNote);
  }
}
