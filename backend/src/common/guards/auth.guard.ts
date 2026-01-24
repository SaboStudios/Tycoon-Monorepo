import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JwtAuthGuard - Use this guard to protect routes that require JWT authentication.
 * Apply with @UseGuards(JwtAuthGuard) decorator.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') { }
