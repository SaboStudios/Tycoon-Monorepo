import { registerAs } from '@nestjs/config';

export const uploadConfig = registerAs('upload', () => ({
  /** Max upload size in bytes (default 5 MB). */
  maxFileSizeBytes: parseInt(process.env.UPLOAD_MAX_FILE_SIZE_MB || '5', 10) * 1024 * 1024,
  /** Comma-separated list of allowed MIME types. */
  allowedMimeTypes: (
    process.env.UPLOAD_ALLOWED_MIME_TYPES || 'image/jpeg,image/png,image/gif,image/webp'
  ).split(','),
  /** S3 bucket name. When set, files are stored in S3; otherwise local disk is used. */
  s3Bucket: process.env.AWS_S3_BUCKET || '',
  s3Region: process.env.AWS_REGION || 'us-east-1',
  /** Optional custom S3-compatible endpoint (e.g. MinIO). */
  s3Endpoint: process.env.AWS_S3_ENDPOINT || '',
  /** TTL for pre-signed GET URLs in seconds (default 1 hour). */
  signedUrlTtlSeconds: parseInt(process.env.SIGNED_URL_TTL_SECONDS || '3600', 10),
  /** ClamAV host. When set, every upload is scanned before storage. */
  clamavHost: process.env.CLAMAV_HOST || '',
  clamavPort: parseInt(process.env.CLAMAV_PORT || '3310', 10),
  /** Directory for local disk storage fallback. */
  localUploadDir: process.env.UPLOAD_DIR || './storage/uploads',
}));
