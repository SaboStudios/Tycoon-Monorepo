import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { VirusScanService } from './virus-scan.service';
import { MulterExceptionFilter } from './multer-exception.filter';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ConfigService } from '@nestjs/config';

// ---------------------------------------------------------------------------
// Minimal JPEG magic bytes (SOI marker: FF D8 FF E0, then 8 bytes padding)
// ---------------------------------------------------------------------------
const JPEG_MAGIC = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);

// ELF executable magic bytes
const ELF_MAGIC = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);

// A buffer with no recognised magic bytes (e.g. plain text / PDF)
const UNKNOWN_MAGIC = Buffer.from('%PDF-1.4 fake content');

// Oversize buffer: 6 MB of zeros
const OVERSIZE_BUFFER = Buffer.alloc(6 * 1024 * 1024, 0);

// ---------------------------------------------------------------------------
// Mock services
// ---------------------------------------------------------------------------
const mockUploadsService = {
  store: jest.fn().mockResolvedValue({ key: 'test-key/avatar.jpg', url: '/uploads/download?token=tok' }),
  signedUrl: jest.fn().mockResolvedValue('/uploads/download?token=tok'),
  resolveLocalDownload: jest.fn(),
};

const mockVirusScan = {
  scan: jest.fn().mockResolvedValue(undefined),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue(undefined),
};

const allowAllGuard = { canActivate: jest.fn().mockReturnValue(true) };

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('UploadsController – integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [UploadsController],
      providers: [
        { provide: UploadsService, useValue: mockUploadsService },
        { provide: VirusScanService, useValue: mockVirusScan },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allowAllGuard)
      .overrideGuard(AdminGuard)
      .useValue(allowAllGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    app.useGlobalFilters(new MulterExceptionFilter());
    await app.init();
  });

  afterAll(() => app.close());

  afterEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------------
  // Avatar upload – rejects oversize files
  // -------------------------------------------------------------------------
  describe('POST /uploads/avatar', () => {
    it('rejects an oversize file with 413', async () => {
      const res = await request(app.getHttpServer())
        .post('/uploads/avatar')
        .attach('file', OVERSIZE_BUFFER, { filename: 'big.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(413);
    });

    it('rejects a file with wrong MIME type (no valid image magic bytes) with 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/uploads/avatar')
        .attach('file', UNKNOWN_MAGIC, {
          filename: 'document.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(400);
    });

    it('rejects an executable file disguised as an image with 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/uploads/avatar')
        .attach('file', ELF_MAGIC, { filename: 'malware.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(400);
    });

    it('rejects a file whose declared MIME does not match its magic bytes with 400', async () => {
      // Send a JPEG buffer but declare it as PNG
      const res = await request(app.getHttpServer())
        .post('/uploads/avatar')
        .attach('file', JPEG_MAGIC, { filename: 'trick.png', contentType: 'image/png' });

      expect(res.status).toBe(400);
    });

    it('accepts a valid JPEG and returns 201 with a signed URL', async () => {
      const res = await request(app.getHttpServer())
        .post('/uploads/avatar')
        .attach('file', JPEG_MAGIC, { filename: 'avatar.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('key');
      expect(res.body).toHaveProperty('url');
      expect(mockVirusScan.scan).toHaveBeenCalledTimes(1);
      expect(mockUploadsService.store).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Admin asset upload
  // -------------------------------------------------------------------------
  describe('POST /uploads/admin/assets', () => {
    it('rejects an oversize file with 413', async () => {
      const res = await request(app.getHttpServer())
        .post('/uploads/admin/assets')
        .attach('file', OVERSIZE_BUFFER, { filename: 'big.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(413);
    });

    it('rejects a wrong-MIME file with 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/uploads/admin/assets')
        .attach('file', UNKNOWN_MAGIC, {
          filename: 'script.sh',
          contentType: 'application/x-sh',
        });

      expect(res.status).toBe(400);
    });

    it('accepts a valid JPEG asset and returns 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/uploads/admin/assets')
        .attach('file', JPEG_MAGIC, { filename: 'banner.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('url');
    });
  });
});

// ---------------------------------------------------------------------------
// Unit tests for validators (no HTTP overhead)
// ---------------------------------------------------------------------------
import { MagicBytesValidator, NoExecutableValidator } from './upload-validators';

describe('MagicBytesValidator', () => {
  const validator = new MagicBytesValidator();

  it('passes a real JPEG buffer', () => {
    const file = { buffer: JPEG_MAGIC, mimetype: 'image/jpeg' } as Express.Multer.File;
    expect(validator.isValid(file)).toBe(true);
  });

  it('fails when declared MIME does not match magic bytes', () => {
    const file = { buffer: JPEG_MAGIC, mimetype: 'image/png' } as Express.Multer.File;
    expect(validator.isValid(file)).toBe(false);
  });

  it('passes a PNG buffer', () => {
    const pngBuf = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
    ]);
    const file = { buffer: pngBuf, mimetype: 'image/png' } as Express.Multer.File;
    expect(validator.isValid(file)).toBe(true);
  });

  it('fails an empty / too-small buffer', () => {
    const file = { buffer: Buffer.alloc(2), mimetype: 'image/jpeg' } as Express.Multer.File;
    expect(validator.isValid(file)).toBe(false);
  });
});

describe('NoExecutableValidator', () => {
  const validator = new NoExecutableValidator();

  it('blocks an ELF binary', () => {
    const file = { buffer: ELF_MAGIC, mimetype: 'image/jpeg' } as Express.Multer.File;
    expect(validator.isValid(file)).toBe(false);
  });

  it('blocks a Windows PE (MZ) binary', () => {
    const pe = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
    const file = { buffer: pe, mimetype: 'image/jpeg' } as Express.Multer.File;
    expect(validator.isValid(file)).toBe(false);
  });

  it('blocks a shell script (shebang)', () => {
    const sh = Buffer.from('#!/bin/bash\nrm -rf /');
    const file = { buffer: sh, mimetype: 'text/plain' } as Express.Multer.File;
    expect(validator.isValid(file)).toBe(false);
  });

  it('passes a normal JPEG buffer', () => {
    const file = { buffer: JPEG_MAGIC, mimetype: 'image/jpeg' } as Express.Multer.File;
    expect(validator.isValid(file)).toBe(true);
  });
});
