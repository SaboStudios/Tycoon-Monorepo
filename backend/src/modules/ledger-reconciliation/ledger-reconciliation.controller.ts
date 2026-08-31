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
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { LedgerReconciliationService } from './ledger-reconciliation.service';
import {
  TriggerReconciliationDto,
  ResolveDiscrepancyDto,
} from './dto/reconciliation.dto';

@ApiTags('admin-ledger-reconciliation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/ledger-reconciliation')
@ApiResponse({
  status: HttpStatus.FORBIDDEN,
  description: 'Forbidden. Admin role required.',
})
@ApiResponse({
  status: HttpStatus.UNAUTHORIZED,
  description: 'Unauthorized.',
})
export class LedgerReconciliationController {
  constructor(private readonly service: LedgerReconciliationService) {}

  /**
   * Manually trigger a reconciliation run.
   * Defaults to dry-run=true for safety.
   */
  @Post('run')
  @ApiOperation({ summary: 'Manually trigger a reconciliation run (admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Reconciliation run completed.',
  })
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
  @ApiOperation({ summary: 'List reconciliation discrepancies (admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of discrepancies.',
  })
  async listDiscrepancies(@Query('runId') runId?: string) {
    return this.service.findDiscrepancies(runId);
  }

  /** Mark a discrepancy as resolved with a note */
  @Patch('discrepancies/:id/resolve')
  @ApiOperation({ summary: 'Resolve a discrepancy (admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Discrepancy resolved.',
  })
  async resolve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResolveDiscrepancyDto,
  ) {
    return this.service.resolveDiscrepancy(id, dto.resolutionNote);
  }
}
