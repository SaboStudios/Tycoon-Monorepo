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

@Controller('admin')
export class AdminAuthController {
  private readonly logger = new Logger(AdminAuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() adminLoginDto: AdminLoginDto) {
    this.logger.log(`Admin login attempt for email: ${adminLoginDto.email}`);

    const user = await this.authService.validateAdmin(
      adminLoginDto.email,
      adminLoginDto.password,
    );

    if (!user) {
      this.logger.warn(
        `Failed admin login attempt for email: ${adminLoginDto.email}`,
      );
      throw new UnauthorizedException('Invalid admin credentials');
    }

    this.logger.log(`Successful admin login for email: ${adminLoginDto.email}`);

    return this.authService.login({
      id: user.id,
      email: user.email,
      role: user.role,
      is_admin: user.is_admin,
    });
  }
}
