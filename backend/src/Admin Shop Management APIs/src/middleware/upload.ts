import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomBytes } from 'crypto';

const uploadDir = process.env.UPLOAD_DIR || 'uploads';
const MAX_FILE_SIZE_BYTES =
  parseInt(process.env.UPLOAD_MAX_FILE_SIZE_MB || '5', 10) * 1024 * 1024;

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ---------------------------------------------------------------------------
// Allowed MIME types (both header declaration and extension must match)
// ---------------------------------------------------------------------------
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

// ---------------------------------------------------------------------------
// Allowed file extensions (allowlist). Anything else is rejected outright.
// ---------------------------------------------------------------------------
const ALLOWED_EXTENSIONS = new Set(['jpeg', 'jpg', 'png', 'gif', 'webp']);

/**
 * Returns the lower-cased extension (without the dot) when it is on the
 * allowlist, otherwise `null`.
 */
export function getAllowedExtension(originalname: string): string | null {
  const ext = path.extname(originalname).toLowerCase().replace('.', '');
  return ALLOWED_EXTENSIONS.has(ext) ? ext : null;
}

/**
 * Builds a collision-resistant, time-independent file name.
 * Uses 16 random bytes (128 bits) of entropy.
 */
export function generateUploadFileName(originalname: string): string {
  const ext = getAllowedExtension(originalname);
  if (!ext) {
    throw new Error('Only JPEG, PNG, GIF, and WebP image files are allowed');
  }
  return `${randomBytes(16).toString('hex')}.${ext}`;
}

// ---------------------------------------------------------------------------
// Executable magic-byte patterns that must never be stored, regardless of the
// declared MIME type or file extension.
// ---------------------------------------------------------------------------
const EXECUTABLE_SIGNATURES: Array<{ label: string; offset: number; bytes: number[] }> = [
  { label: 'ELF',       offset: 0, bytes: [0x7f, 0x45, 0x4c, 0x46] },
  { label: 'MZ/PE',     offset: 0, bytes: [0x4d, 0x5a] },
  { label: 'Mach-O BE', offset: 0, bytes: [0xca, 0xfe, 0xba, 0xbe] },
  { label: 'Mach-O LE', offset: 0, bytes: [0xce, 0xfa, 0xed, 0xfe] },
  { label: 'Mach-O 64', offset: 0, bytes: [0xcf, 0xfa, 0xed, 0xfe] },
  { label: 'shebang',   offset: 0, bytes: [0x23, 0x21] }, // #!
];

function hasExecutableMagic(buf: Buffer): string | null {
  for (const sig of EXECUTABLE_SIGNATURES) {
    if (buf.length >= sig.offset + sig.bytes.length) {
      const matches = sig.bytes.every((b, i) => buf[sig.offset + i] === b);
      if (matches) return sig.label;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Disk storage – kept for backwards compatibility with existing shop routes
// ---------------------------------------------------------------------------
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    try {
      cb(null, generateUploadFileName(file.originalname));
    } catch (err) {
      cb(err as Error, '');
    }
  },
});

// ---------------------------------------------------------------------------
// File filter – checks declared MIME and extension (magic-bytes check happens
// in the route handler via the stored file, see shopRoutes.ts)
// ---------------------------------------------------------------------------
const fileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void => {
  const ext = getAllowedExtension(file.originalname);

  if (!ALLOWED_MIME.has(file.mimetype) || !ext) {
    return cb(new Error('Only JPEG, PNG, GIF, and WebP image files are allowed'));
  }

  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 10 },
});

/**
 * Post-storage executable guard.
 *
 * Call this after `upload` middleware to verify the saved file does not
 * contain executable magic bytes. On detection, the file is removed from
 * disk and a 400 error is forwarded.
 *
 * Usage in a route:
 *   router.post('/:id/images', auth, requireAdmin, upload.array('images', 5), rejectExecutables, handler)
 */
export function rejectExecutables(
  req: any,
  _res: any,
  next: (err?: Error) => void,
): void {
  const files: Express.Multer.File[] = Array.isArray(req.files)
    ? req.files
    : req.file
      ? [req.file]
      : [];

  for (const file of files) {
    // Read first 8 bytes from disk to check magic
    let header: Buffer;
    try {
      const fd = fs.openSync(file.path, 'r');
      header = Buffer.alloc(8);
      fs.readSync(fd, header, 0, 8, 0);
      fs.closeSync(fd);
    } catch {
      // If we can't read the file, reject it
      safeUnlink(file.path);
      return next(new Error('Could not validate uploaded file'));
    }

    const label = hasExecutableMagic(header);
    if (label) {
      safeUnlink(file.path);
      return next(new Error(`Executable file content (${label}) is not allowed`));
    }
  }

  next();
}

function safeUnlink(filePath: string): void {
  try {
    fs.unlinkSync(filePath);
  } catch {
    // best-effort cleanup
  }
}
