import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from '../users/entities/user.entity';
import { Role } from './enums/role.enum';

@Injectable()
export class AuthService {
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
    if (
      user &&
      !user.is_suspended &&
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
    if (
      user &&
      !user.is_suspended &&
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

  async createRefreshToken(userId: number): Promise<RefreshToken> {
    const refreshExpiresInSeconds =
      this.configService.get<number>('jwt.refreshExpiresIn') || 604800;
    const expiresAt = new Date(Date.now() + refreshExpiresInSeconds * 1000);

    const token = this.jwtService.sign(
      { sub: userId.toString(), type: 'refresh' } as object,
      { expiresIn: refreshExpiresInSeconds },
    );

    const refreshToken = this.refreshTokenRepository.create({
      token,
      userId,
      expiresAt,
    });

    return await this.refreshTokenRepository.save(refreshToken);
  }

  async refreshTokens(refreshTokenString: string) {
    const refreshToken = await this.refreshTokenRepository.findOne({
      where: { token: refreshTokenString, isRevoked: false },
      relations: ['user'],
    });

    if (!refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
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
    const newRefreshToken = await this.createRefreshToken(user.id);

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
