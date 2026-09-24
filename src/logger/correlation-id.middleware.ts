import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { clsNamespace, setRequestId } from "./correlation.context";

export const REQUEST_ID_HEADER = "x-request-id";

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const id =
      (req.headers[REQUEST_ID_HEADER] as string | undefined) ?? uuidv4();

    clsNamespace.bindEmitter(req);
    clsNamespace.bindEmitter(res);

    clsNamespace.run(() => {
      setRequestId(id);
      res.setHeader(REQUEST_ID_HEADER, id);
      next();
    });
  }
}
