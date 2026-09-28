import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import * as express from 'express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserDataExportService } from './user-data-export.service';
import { RecentAuthGuard } from './recent-auth.guard';

interface RequestWithUser extends express.Request {
  user: { id: number };
}

/**
 * Self-service data export. The subject is always the authenticated
 * principal — there is no client-supplied userId. See
 * docs/support/user-data-export-runbook.md.
 */
@Controller('users/me')
export class UserMeDataExportController {
  constructor(private readonly exports: UserDataExportService) {}

  /**
   * Requires a recent primary login (step-up, #1766). Idempotent per user:
   * while an export is pending/processing, repeated calls return that job.
   */
  @Post('data-export')
  @UseGuards(JwtAuthGuard, RecentAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 3_600_000 } })
  async requestExport(@Request() req: RequestWithUser) {
    return this.exports.requestExport(req.user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('data-export/:jobId')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async getStatus(
    @Request() req: RequestWithUser,
    @Param('jobId', ParseIntPipe) jobId: number,
  ) {
    return this.exports.getStatus(req.user.id, jobId);
  }
}
