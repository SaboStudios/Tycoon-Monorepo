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

import { AdminLogsService } from '../admin-logs/admin-logs.service';
import * as express from 'express';
import { Req } from '@nestjs/common';

@Controller('admin')
export class AdminAuthController {
  private readonly logger = new Logger(AdminAuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly adminLogsService: AdminLogsService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() adminLoginDto: AdminLoginDto,
    @Req() req: express.Request,
  ) {
    this.logger.log(`Admin login attempt for email: ${adminLoginDto.email}`);

    const user = await this.authService.validateAdmin(
      adminLoginDto.email,
      adminLoginDto.password,
    );

    if (!user) {
      this.logger.warn(
        `Failed admin login attempt for email: ${adminLoginDto.email}`,
      );

      await this.adminLogsService.createLog(
        undefined,
        'ADMIN_LOGIN_FAILED',
        undefined,
        { email: adminLoginDto.email },
        req,
      );

      throw new UnauthorizedException('Invalid admin credentials');
    }

    this.logger.log(`Successful admin login for email: ${adminLoginDto.email}`);

    await this.adminLogsService.createLog(
      user.id,
      'ADMIN_LOGIN_SUCCESS',
      user.id,
      { email: user.email },
      req,
    );

    return this.authService.login({
      id: user.id,
      email: user.email,
      role: user.role,
      is_admin: user.is_admin,
    });
  }
}
