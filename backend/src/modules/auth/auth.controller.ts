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
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
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

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * POST /auth/login
   * Rate limit: 5 requests / 60 s per IP (brute-force protection).
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with email + password' })
  @ApiResponse({ status: HttpStatus.OK, description: 'JWT access + refresh tokens returned.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid credentials.' })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Rate limit exceeded: max 5 requests per 60 s per IP.',
  })
  async login(@Request() req: RequestWithUser) {
    return this.authService.login(
      {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
        is_admin: req.user.is_admin,
      },
      req.ip,
      req.headers?.['user-agent'],
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using a refresh token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'New access + refresh token pair.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid or expired refresh token.' })
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

  /**
   * POST /auth/wallet-login
   * Rate limit: 20 requests / 60 s per IP.
   */
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('wallet-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate via Web3 wallet signature' })
  @ApiBody({ type: WalletLoginDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'JWT access + refresh tokens returned.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid wallet signature.' })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Rate limit exceeded: max 20 requests per 60 s per IP.',
  })
  async walletLogin(@Body() body: WalletLoginDto, @Req() req: RequestWithUser) {
    return this.authService.walletLogin(
      body.address,
      body.chain,
      req.ip,
      req.headers?.['user-agent'],
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Invalidate the current session (requires JWT)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Session invalidated.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Missing or invalid JWT.' })
  async logout(@Request() req: RequestWithUser) {
    return this.authService.logout(
      req.user.sub,
      req.ip,
      req.headers?.['user-agent'],
    );
  }

  /**
   * POST /auth/register
   * Rate limit: 10 requests / 60 s per IP (account creation spam protection).
   */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Account created.' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed.' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Email already registered.' })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Rate limit exceeded: max 10 requests per 60 s per IP.',
  })
  async register(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }
}
