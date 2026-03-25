import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';

@Injectable()
export class SuspensionCheckMiddleware implements NestMiddleware {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const user = (req as any).user;

    if (user && user.sub) {
      const dbUser = await this.userRepo.findOne({ where: { id: user.sub } });

      if (dbUser?.is_suspended) {
        throw new ForbiddenException(
          'Your account has been suspended. Please contact support.',
        );
      }
    }

    next();
  }
}
