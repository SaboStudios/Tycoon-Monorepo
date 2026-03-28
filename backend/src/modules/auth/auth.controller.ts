import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { WalletLoginDto } from './dto/wallet-login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

interface RequestWithUser {
  user: JwtPayload;
  ip?: string;
  headers?: {
    'user-agent'?: string;
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Request() req: RequestWithUser) {
    return this.authService.login({
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      is_admin: req.user.is_admin,
    });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() req: RequestWithUser,
  ) {
    const ipAddress = req.ip;
    const userAgent = req.headers?.['user-agent'];
    return this.authService.refreshTokens(
      refreshTokenDto.refreshToken,
      ipAddress,
      userAgent,
    );
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('wallet-login')
  @HttpCode(HttpStatus.OK)
  async walletLogin(@Body() body: WalletLoginDto) {
    return this.authService.walletLogin(body.address, body.chain);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req: RequestWithUser) {
    return this.authService.logout(req.user.sub);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }
}
