import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { json } from 'body-parser';

@Injectable()
export class RawBodyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    json({
      verify: (req: any, res, buf) => {
        req.rawBody = buf;
      },
    })(req, res, next);
  }
}
