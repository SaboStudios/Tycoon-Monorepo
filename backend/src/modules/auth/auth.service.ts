import { ConflictException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from '../users/entities/user.entity';
import { CreateUserDto } from '../users/dto/create-user.dto';
@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(RefreshToken) 
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(User) 
    private readonly userRepo: Repository<User>
    
  ) {}
e
  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && (await bcrypt.compare(password, user.password))) {
      const { password: _, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.createRefreshToken(user.id);

    return {
      accessToken,
      refreshToken: refreshToken.token,
    };
  }

  async createRefreshToken(userId: string): Promise<RefreshToken> {
    const refreshExpiresInSeconds = this.configService.get<number>('jwt.refreshExpiresIn') || 604800;
    const expiresAt = new Date(Date.now() + refreshExpiresInSeconds * 1000);

    const token = this.jwtService.sign(
      { sub: userId, type: 'refresh' } as object,
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

  async logout(userId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { userId, isRevoked: false },
      { isRevoked: true },
    );
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  }

  async CreateUser(dto:any): Promise<User> {
    const { username, address } = dto;
    const chain = dto.chain || 'BASE';
  try {

    const existingUsername = await this.userRepo.findOne({
      where: { username }, });

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

    
  } catch (error) {
    throw new InternalServerErrorException('Failed to create user');
  }

}
}


