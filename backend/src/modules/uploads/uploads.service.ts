import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { mkdir, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';

export interface StoredFile {
  /** Storage key (S3 key or relative path for local). */
  key: string;
  /** Pre-signed URL valid for `signedUrlTtlSeconds` seconds. */
  url: string;
}

interface DownloadTokenPayload {
  typ: 'upload-download';
  key: string;
}

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly s3: S3Client | null;

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {
    const bucket = this.config.get<string>('upload.s3Bucket');
    if (bucket) {
      const region = this.config.get<string>('upload.s3Region') ?? 'us-east-1';
      const endpoint = this.config.get<string>('upload.s3Endpoint') || undefined;
      this.s3 = new S3Client({ region, ...(endpoint ? { endpoint } : {}) });
      this.logger.log(`S3 storage enabled – bucket: ${bucket}`);
    } else {
      this.s3 = null;
      this.logger.warn('AWS_S3_BUCKET not set – falling back to local disk storage');
    }
  }

  async store(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
  ): Promise<StoredFile> {
    const key = `${Date.now()}-${randomBytes(8).toString('hex')}/${originalName}`;

    if (this.s3) {
      await this.storeS3(buffer, key, mimeType);
      const url = await this.getS3SignedUrl(key);
      return { key, url };
    }

    await this.storeLocal(buffer, key);
    const url = this.buildLocalSignedUrl(key);
    return { key, url };
  }

  /**
   * Generate a fresh signed download URL for a previously stored key.
   * Useful when the original URL has expired.
   */
  async signedUrl(key: string): Promise<string> {
    return this.s3 ? this.getS3SignedUrl(key) : this.buildLocalSignedUrl(key);
  }

  /**
   * Resolve a local download token and return the raw file buffer.
   * Only relevant when S3 is not configured.
   */
  async resolveLocalDownload(token: string): Promise<{ buffer: Buffer; key: string }> {
    const payload = await this.jwt.verifyAsync<DownloadTokenPayload>(token);
    if (payload.typ !== 'upload-download') {
      throw new Error('Invalid token type');
    }
    const baseDir =
      this.config.get<string>('upload.localUploadDir') ?? './storage/uploads';
    const filePath = join(baseDir, payload.key);
    const buffer = await readFile(filePath);
    return { buffer, key: payload.key };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async storeS3(buffer: Buffer, key: string, mimeType: string): Promise<void> {
    const bucket = this.config.get<string>('upload.s3Bucket')!;
    await this.s3!.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: mimeType }),
    );
  }

  private async getS3SignedUrl(key: string): Promise<string> {
    const bucket = this.config.get<string>('upload.s3Bucket')!;
    const ttl = this.config.get<number>('upload.signedUrlTtlSeconds') ?? 3600;
    return getSignedUrl(
      this.s3!,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: ttl },
    );
  }

  private async storeLocal(buffer: Buffer, key: string): Promise<void> {
    const baseDir =
      this.config.get<string>('upload.localUploadDir') ?? './storage/uploads';
    const dir = join(baseDir, key.split('/')[0]);
    await mkdir(dir, { recursive: true });
    await writeFile(join(baseDir, key), buffer);
  }

  private buildLocalSignedUrl(key: string): string {
    const ttl = this.config.get<number>('upload.signedUrlTtlSeconds') ?? 3600;
    const token = this.jwt.sign(
      { typ: 'upload-download', key } satisfies DownloadTokenPayload,
      { expiresIn: ttl },
    );
    return `/uploads/download?token=${token}`;
  }
}
