import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from '../users/entities/user.entity';
import { Role } from './enums/role.enum';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<{
    id: number;
    email: string;
    role: string;
    is_admin: boolean;
  } | null> {
    const user = await this.usersService.findByEmail(email);

    if (user && user.is_suspended) {
      // Log suspended user login attempt
      console.log(`Suspended user login attempt: ${email}`);
      return null;
    }

    if (user && (await bcrypt.compare(password, user.password))) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _password, ...result } = user;
      return result as {
        id: number;
        email: string;
        role: string;
        is_admin: boolean;
      };
    }
    return null;
  }

  async validateAdmin(
    email: string,
    password: string,
  ): Promise<{
    id: number;
    email: string;
    role: string;
    is_admin: boolean;
  } | null> {
    const user = await this.usersService.findByEmail(email);

    if (user && user.is_suspended) {
      // Log suspended admin login attempt
      console.log(`Suspended admin login attempt: ${email}`);
      return null;
    }

    if (
      user &&
      (user.role === Role.ADMIN || user.is_admin) &&
      (await bcrypt.compare(password, user.password))
    ) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _password, ...result } = user;
      return result as {
        id: number;
        email: string;
        role: string;
        is_admin: boolean;
      };
    }
    return null;
  }

  async login(user: {
    id: number;
    email: string;
    role: string;
    is_admin: boolean;
  }) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      is_admin: user.is_admin,
    };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.createRefreshToken(Number(user.id));

    return {
      accessToken,
      refreshToken: refreshToken.token,
    };
  }

  async walletLogin(address: string, chain: string) {
    if (!address || !chain) {
      throw new BadRequestException('Address and chain are required');
    }

    const user = await this.userRepo.findOne({ where: { address, chain } });

    if (!user) {
      throw new NotFoundException('Invalid address/chain combination');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      is_admin: user.is_admin,
    };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.createRefreshToken(user.id);

    return {
      accessToken,
      refreshToken: refreshToken.token,
      user: {
        id: user.id,
        username: user.username,
        address: user.address,
        chain: user.chain,
      },
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async createRefreshToken(
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ token: string; entity: RefreshToken }> {
    const refreshExpiresInSeconds =
      this.configService.get<number>('jwt.refreshExpiresIn') || 604800;
    const expiresAt = new Date(Date.now() + refreshExpiresInSeconds * 1000);

    // Generate a unique token ID to ensure each token is unique
    const jti = crypto.randomBytes(16).toString('hex');

    const token = this.jwtService.sign(
      { sub: userId.toString(), type: 'refresh', jti } as object,
      { expiresIn: refreshExpiresInSeconds },
    );

    const tokenHash = this.hashToken(token);

    const refreshToken = this.refreshTokenRepository.create({
      tokenHash,
      userId,
      expiresAt,
      ipAddress,
      userAgent,
      lastUsedAt: new Date(),
    });

    const entity = await this.refreshTokenRepository.save(refreshToken);

    return { token, entity };
  }

  async refreshTokens(
    refreshTokenString: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const tokenHash = this.hashToken(refreshTokenString);

    const refreshToken = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
      relations: ['user'],
    });

    if (!refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if token is revoked - this indicates potential reuse attack
    if (refreshToken.isRevoked) {
      this.logger.warn(
        `Refresh token reuse detected for user ${refreshToken.userId}. Revoking all tokens.`,
      );

      // Revoke all tokens for this user as a security measure
      await this.refreshTokenRepository.update(
        { userId: refreshToken.userId },
        { isRevoked: true },
      );

      throw new UnauthorizedException('Token reuse detected');
    }

    if (new Date() > refreshToken.expiresAt) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Revoke the old refresh token
    refreshToken.isRevoked = true;
    await this.refreshTokenRepository.save(refreshToken);

    // Generate new tokens
    const user = refreshToken.user;
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      is_admin: user.is_admin,
    };
    const accessToken = this.jwtService.sign(payload);
    const newRefreshToken = await this.createRefreshToken(
      user.id,
      ipAddress,
      userAgent,
    );

    return {
      accessToken,
      refreshToken: newRefreshToken.token,
    };
  }

  async logout(userId: number): Promise<void> {
    await this.refreshTokenRepository.update(
      { userId, isRevoked: false },
      { isRevoked: true },
    );
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  }

  async CreateUser(dto: {
    username: string;
    address: string;
    chain?: string;
  }): Promise<User> {
    const { username, address } = dto;
    const chain = dto.chain || 'BASE';
    try {
      const existingUsername = await this.userRepo.findOne({
        where: { username },
      });

      if (existingUsername) {
        throw new ConflictException('Username already taken');
      }

      const existingAddress = await this.userRepo.findOne({
        where: { address },
      });
      if (existingAddress) {
        throw new ConflictException('Address already registered');
      }

      const user = this.userRepo.create({
        username,
        address,
        chain,
        games_played: 0,
        game_won: 0,
        game_lost: 0,
        total_staked: '0',
        total_earned: '0',
        total_withdrawn: '0',
      });

      const savedUser = await this.userRepo.save(user);

      return savedUser;
    } catch {
      throw new InternalServerErrorException('Failed to create user');
    }
  }
}
