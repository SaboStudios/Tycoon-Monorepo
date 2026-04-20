import { FileValidator } from '@nestjs/common';

/**
 * Allowed image MIME types mapped to their magic-byte signatures.
 * Each entry is [byteOffset, expectedBytes].
 */
const ALLOWED_SIGNATURES: Record<string, Array<[number, number[]]>> = {
  'image/jpeg': [[0, [0xff, 0xd8, 0xff]]],
  'image/png': [[0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]]],
  'image/gif': [[0, [0x47, 0x49, 0x46, 0x38]]],
  // RIFF....WEBP
  'image/webp': [
    [0, [0x52, 0x49, 0x46, 0x46]],
    [8, [0x57, 0x45, 0x42, 0x50]],
  ],
};

/** Magic-byte patterns that indicate executable content. */
const EXECUTABLE_SIGNATURES: Array<{ label: string; offset: number; bytes: number[] }> = [
  { label: 'ELF',       offset: 0, bytes: [0x7f, 0x45, 0x4c, 0x46] },
  { label: 'MZ/PE',     offset: 0, bytes: [0x4d, 0x5a] },
  { label: 'Mach-O BE', offset: 0, bytes: [0xca, 0xfe, 0xba, 0xbe] },
  { label: 'Mach-O LE', offset: 0, bytes: [0xce, 0xfa, 0xed, 0xfe] },
  { label: 'Mach-O 64', offset: 0, bytes: [0xcf, 0xfa, 0xed, 0xfe] },
  { label: 'shebang',   offset: 0, bytes: [0x23, 0x21] }, // #!
];

function matchesBytes(buf: Buffer, offset: number, expected: number[]): boolean {
  if (buf.length < offset + expected.length) return false;
  return expected.every((b, i) => buf[offset + i] === b);
}

/**
 * Validates that the uploaded file's magic bytes match one of the permitted
 * image MIME types AND that the declared Content-Type agrees.
 */
export class MagicBytesValidator extends FileValidator<Record<string, never>> {
  constructor() {
    super({});
  }

  isValid(file: Express.Multer.File): boolean {
    const buf = file.buffer;
    if (!buf) return false;

    const sigs = ALLOWED_SIGNATURES[file.mimetype];
    if (!sigs) return false;

    const minLen = sigs.reduce(
      (acc, [offset, bytes]) => Math.max(acc, offset + bytes.length),
      0,
    );
    if (buf.length < minLen) return false;

    return sigs.every(([offset, bytes]) => matchesBytes(buf, offset, bytes));
  }

  buildErrorMessage(): string {
    return 'File type not permitted. Only JPEG, PNG, GIF, and WebP images are accepted.';
  }
}

/**
 * Rejects files whose magic bytes match known executable formats,
 * regardless of the declared MIME type or file extension.
 */
export class NoExecutableValidator extends FileValidator<Record<string, never>> {
  constructor() {
    super({});
  }

  isValid(file: Express.Multer.File): boolean {
    const buf = file.buffer;
    if (!buf || buf.length < 4) return true; // too small to be an executable

    for (const sig of EXECUTABLE_SIGNATURES) {
      if (matchesBytes(buf, sig.offset, sig.bytes)) {
        return false;
      }
    }
    return true;
  }

  buildErrorMessage(): string {
    return 'Executable files are not allowed.';
  }
}
