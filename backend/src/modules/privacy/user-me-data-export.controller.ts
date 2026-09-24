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

interface RequestWithUser extends express.Request {
  user: { id: number };
}

@Controller('users/me')
export class UserMeDataExportController {
  constructor(private readonly exports: UserDataExportService) {}

  @Post('data-export')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 3_600_000 } })
  async requestExport(@Request() req: RequestWithUser) {
    return this.exports.requestExport(req.user.id);
  }

  @Get('data-export/:jobId')
  @UseGuards(JwtAuthGuard)
  async getStatus(
    @Request() req: RequestWithUser,
    @Param('jobId', ParseIntPipe) jobId: number,
  ) {
    return this.exports.getStatus(req.user.id, jobId);
  }
}
