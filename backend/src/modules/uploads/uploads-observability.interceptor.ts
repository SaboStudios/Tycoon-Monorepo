import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  HttpException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { randomBytes } from 'crypto';
import { UploadsObservabilityService, UploadOutcomeLabel } from './uploads-observability.service';

function classifyUploadError(err: unknown): UploadOutcomeLabel {
  if (err instanceof BadRequestException) return 'validation_error';
  if (err instanceof PayloadTooLargeException) return 'multer_error';
  if (err instanceof HttpException) {
    const status = err.getStatus();
    if (status === 413) return 'multer_error';
    if (status === 400) return 'validation_error';
    if (status >= 500) {
      const res = err.getResponse();
      const msg =
        typeof res === 'string'
          ? res
          : res && typeof res === 'object' && 'message' in res
            ? (res as { message?: string | string[] }).message
            : undefined;
      const flat = Array.isArray(msg) ? msg.join(' ') : String(msg ?? (err as Error).message ?? '');
      if (/malware|virus|clamav/i.test(flat)) return 'virus_error';
      return 'storage_error';
    }
  }
  return 'unknown_error';
}

/** Coarse route bucket for metrics (no raw paths — avoids leaking IDs). */
export function uploadsRouteLabel(path: string): string {
  if (path.includes('/avatar')) return 'avatar';
  if (path.includes('/admin/assets')) return 'admin_asset';
  if (path.includes('/signed-url')) return 'signed_url';
  if (path.includes('/download')) return 'download';
  if (path.includes('/batch')) return 'batch';
  if (path.includes('/uploads-enhanced/stats') || path.endsWith('/stats')) return 'stats';
  if (path.includes('/file')) return 'file_delete';
  if (/\/uploads-enhanced\/?$/i.test(path.split('?')[0] || '')) return 'list';
  return 'other';
}

@Injectable()
export class UploadsObservabilityInterceptor implements NestInterceptor {
  constructor(private readonly obs: UploadsObservabilityService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      path?: string;
      url?: string;
      headers: Record<string, string | string[] | undefined>;
      file?: Express.Multer.File;
    }>();
    const path = req.path || req.url || '';
    const route = uploadsRouteLabel(path);
    const traceHeader = req.headers['x-request-id'];
    const traceId =
      typeof traceHeader === 'string' && traceHeader.length > 0 && traceHeader.length <= 128
        ? traceHeader
        : randomBytes(8).toString('hex');
    (req as { uploadTraceId?: string }).uploadTraceId = traceId;

    const t0 = process.hrtime.bigint();

    return next.handle().pipe(
      tap(() => {
        const dur = Number(process.hrtime.bigint() - t0) / 1e9;
        const file = req.file;
        this.obs.recordUploadOutcome({
          route,
          outcome: 'success',
          durationSeconds: dur,
          traceId,
          mimeType: file?.mimetype,
          sizeBytes: file?.size ?? file?.buffer?.length,
        });
      }),
      catchError((err) => {
        const dur = Number(process.hrtime.bigint() - t0) / 1e9;
        const file = req.file;
        this.obs.recordUploadOutcome({
          route,
          outcome: classifyUploadError(err),
          durationSeconds: dur,
          traceId,
          mimeType: file?.mimetype,
          sizeBytes: file?.size ?? file?.buffer?.length,
        });
        return throwError(() => err);
      }),
    );
  }
}
