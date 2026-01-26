import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RefreshToken } from './entities/refresh-token.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<{ id: string; email: string; role: string } | null> {
    const user = await this.usersService.findByEmail(email);
    if (user && (await bcrypt.compare(password, user.password))) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: { id: string; email: string; role: string }) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.createRefreshToken(user.id);

    return {
      accessToken,
      refreshToken: refreshToken.token,
    };
  }

  async createRefreshToken(userId: number): Promise<RefreshToken> {
    const refreshExpiresInSeconds = this.configService.get<number>('jwt.refreshExpiresIn') || 604800;
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
    const payload = { sub: user.id, email: user.email, role: user.role };
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
}
