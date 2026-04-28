import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { Throttle } from '@nestjs/throttler';

import { AdminLogsService } from '../admin-logs/admin-logs.service';
import { AuthAuditService } from './audit/auth-audit.service';
import * as express from 'express';
import { Req } from '@nestjs/common';

@Controller('admin')
export class AdminAuthController {
  private readonly logger = new Logger(AdminAuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly adminLogsService: AdminLogsService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() adminLoginDto: AdminLoginDto,
    @Req() req: express.Request,
  ) {
    const redactedEmail = AuthAuditService.redactEmail(adminLoginDto.email);
    this.logger.log(`Admin login attempt for email: ${redactedEmail}`);

    const ipAddress = req.ip;
    const userAgent = req.headers?.['user-agent'];

    const user = await this.authService.validateAdmin(
      adminLoginDto.email,
      adminLoginDto.password,
      ipAddress,
      userAgent,
    );

    if (!user) {
      this.logger.warn(
        `Failed admin login attempt for email: ${redactedEmail}`,
      );

      await this.adminLogsService.createLog(
        undefined,
        'ADMIN_LOGIN_FAILED',
        undefined,
        { email: redactedEmail },
        req,
      );

      throw new UnauthorizedException('Invalid admin credentials');
    }

    this.logger.log(`Successful admin login for email: ${redactedEmail}`);

    await this.adminLogsService.createLog(
      user.id,
      'ADMIN_LOGIN_SUCCESS',
      user.id,
      { email: redactedEmail },
      req,
    );

    return this.authService.login(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        is_admin: user.is_admin,
      },
      ipAddress,
      userAgent,
    );
  }
}
