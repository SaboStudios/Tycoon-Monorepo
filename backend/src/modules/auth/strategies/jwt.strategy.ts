import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from '../enums/role.enum';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') || 'default-secret',
    });
  }

  validate(payload: JwtPayload) {
    // Backward compatibility: default missing fields
    const role = payload.role || Role.USER;
    const is_admin = payload.is_admin ?? false;

    return {
      sub: payload.sub,
      id: payload.sub,
      email: payload.email,
      role: role,
      is_admin: is_admin,
    };
  }
}
