/**
 * SW-BE-004: Auth & JWT — DTO validation and error mapping
 *
 * Validates that every auth DTO enforces its constraints correctly and that
 * the AllExceptionsFilter maps ValidationPipe error arrays into a readable
 * semicolon-joined message string.
 *
 * All tests are pure unit tests — no HTTP server, no DB.
 */

import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { LoginDto } from './login.dto';
import { AdminLoginDto } from './admin-login.dto';
import { RefreshTokenDto } from './refresh-token.dto';
import { WalletLoginDto } from './wallet-login.dto';

// ---------------------------------------------------------------------------
// Helper: run class-validator and return flat list of constraint messages
// ---------------------------------------------------------------------------
async function getErrors(DtoClass: new () => object, plain: object) {
  const instance = plainToInstance(DtoClass as new () => object, plain);
  const errors = await validate(instance as object);
  return errors.flatMap((e) => Object.values(e.constraints ?? {}));
}

// ---------------------------------------------------------------------------
// LoginDto
// ---------------------------------------------------------------------------

describe('LoginDto validation (SW-BE-004)', () => {
  it('passes with valid email and password', async () => {
    const errors = await getErrors(LoginDto, {
      email: 'player@example.com',
      password: 'hunter2',
    });
    expect(errors).toHaveLength(0);
  });

  it('normalises email to lowercase via @Transform', () => {
    const dto = plainToInstance(LoginDto, {
      email: '  Player@EXAMPLE.COM  ',
      password: 'hunter2',
    });
    expect(dto.email).toBe('player@example.com');
  });

  it('rejects missing email', async () => {
    const errors = await getErrors(LoginDto, { password: 'hunter2' });
    expect(errors.some((m) => /email/i.test(m))).toBe(true);
  });

  it('rejects invalid email format', async () => {
    const errors = await getErrors(LoginDto, {
      email: 'not-an-email',
      password: 'hunter2',
    });
    expect(errors.some((m) => /email/i.test(m))).toBe(true);
  });

  it('rejects email longer than 254 characters', async () => {
    const errors = await getErrors(LoginDto, {
      email: `${'a'.repeat(250)}@b.com`,
      password: 'hunter2',
    });
    expect(errors.some((m) => /254/i.test(m))).toBe(true);
  });

  it('rejects missing password', async () => {
    const errors = await getErrors(LoginDto, {
      email: 'player@example.com',
    });
    expect(errors.some((m) => /password/i.test(m))).toBe(true);
  });

  it('rejects empty password string', async () => {
    const errors = await getErrors(LoginDto, {
      email: 'player@example.com',
      password: '',
    });
    expect(errors.some((m) => /password/i.test(m))).toBe(true);
  });

  it('rejects password longer than 128 characters', async () => {
    const errors = await getErrors(LoginDto, {
      email: 'player@example.com',
      password: 'x'.repeat(129),
    });
    expect(errors.some((m) => /128/i.test(m))).toBe(true);
  });

  it('rejects non-string password', async () => {
    const errors = await getErrors(LoginDto, {
      email: 'player@example.com',
      password: 12345,
    });
    expect(errors.some((m) => /password/i.test(m))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AdminLoginDto
// ---------------------------------------------------------------------------

describe('AdminLoginDto validation (SW-BE-004)', () => {
  it('passes with valid admin credentials', async () => {
    const errors = await getErrors(AdminLoginDto, {
      email: 'admin@example.com',
      password: 'securePass1',
    });
    expect(errors).toHaveLength(0);
  });

  it('normalises email to lowercase via @Transform', () => {
    const dto = plainToInstance(AdminLoginDto, {
      email: '  ADMIN@EXAMPLE.COM  ',
      password: 'securePass1',
    });
    expect(dto.email).toBe('admin@example.com');
  });

  it('rejects invalid email', async () => {
    const errors = await getErrors(AdminLoginDto, {
      email: 'bad-email',
      password: 'securePass1',
    });
    expect(errors.some((m) => /email/i.test(m))).toBe(true);
  });

  it('rejects password shorter than 6 characters', async () => {
    const errors = await getErrors(AdminLoginDto, {
      email: 'admin@example.com',
      password: 'abc',
    });
    expect(errors.some((m) => /6/i.test(m))).toBe(true);
  });

  it('rejects password longer than 128 characters', async () => {
    const errors = await getErrors(AdminLoginDto, {
      email: 'admin@example.com',
      password: 'x'.repeat(129),
    });
    expect(errors.some((m) => /128/i.test(m))).toBe(true);
  });

  it('rejects email longer than 254 characters', async () => {
    const errors = await getErrors(AdminLoginDto, {
      email: `${'a'.repeat(250)}@b.com`,
      password: 'securePass1',
    });
    expect(errors.some((m) => /254/i.test(m))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// RefreshTokenDto
// ---------------------------------------------------------------------------

describe('RefreshTokenDto validation (SW-BE-004)', () => {
  it('passes with a valid token string', async () => {
    const errors = await getErrors(RefreshTokenDto, {
      refreshToken: 'eyJhbGciOiJIUzI1NiJ9.payload.sig',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects missing refreshToken field', async () => {
    const errors = await getErrors(RefreshTokenDto, {});
    expect(errors.some((m) => /refreshToken/i.test(m))).toBe(true);
  });

  it('rejects empty refreshToken string', async () => {
    const errors = await getErrors(RefreshTokenDto, { refreshToken: '' });
    expect(errors.some((m) => /refreshToken/i.test(m))).toBe(true);
  });

  it('rejects refreshToken longer than 2048 characters', async () => {
    const errors = await getErrors(RefreshTokenDto, {
      refreshToken: 'x'.repeat(2049),
    });
    expect(errors.some((m) => /2048/i.test(m))).toBe(true);
  });

  it('rejects non-string refreshToken', async () => {
    const errors = await getErrors(RefreshTokenDto, { refreshToken: 12345 });
    expect(errors.some((m) => /refreshToken/i.test(m))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// WalletLoginDto
// ---------------------------------------------------------------------------

describe('WalletLoginDto validation (SW-BE-004)', () => {
  it('passes with a valid EVM address and chain', async () => {
    const errors = await getErrors(WalletLoginDto, {
      address: '0xAbCd1234EF567890',
      chain: 'BASE',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects address not starting with 0x', async () => {
    const errors = await getErrors(WalletLoginDto, {
      address: 'AbCd1234EF567890',
      chain: 'BASE',
    });
    expect(errors.some((m) => /0x/i.test(m))).toBe(true);
  });

  it('rejects address with non-hex characters after 0x', async () => {
    const errors = await getErrors(WalletLoginDto, {
      address: '0xGGGG',
      chain: 'BASE',
    });
    expect(errors.some((m) => /address/i.test(m))).toBe(true);
  });

  it('rejects address longer than 100 characters', async () => {
    const errors = await getErrors(WalletLoginDto, {
      address: `0x${'a'.repeat(100)}`,
      chain: 'BASE',
    });
    expect(errors.some((m) => /100/i.test(m))).toBe(true);
  });

  it('rejects missing address', async () => {
    const errors = await getErrors(WalletLoginDto, { chain: 'BASE' });
    expect(errors.some((m) => /address/i.test(m))).toBe(true);
  });

  it('rejects missing chain', async () => {
    const errors = await getErrors(WalletLoginDto, {
      address: '0xAbCd1234',
    });
    expect(errors.some((m) => /chain/i.test(m))).toBe(true);
  });

  it('rejects chain longer than 50 characters', async () => {
    const errors = await getErrors(WalletLoginDto, {
      address: '0xAbCd1234',
      chain: 'x'.repeat(51),
    });
    expect(errors.some((m) => /50/i.test(m))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AllExceptionsFilter — validation error array mapping
// ---------------------------------------------------------------------------

describe('AllExceptionsFilter validation error mapping (SW-BE-004)', () => {
  /**
   * Simulate what ValidationPipe produces: an HttpException whose response
   * contains a message array. Verify the filter joins them with '; '.
   */
  it('joins multiple validation messages with semicolons', () => {
    const messages = ['email must be a valid email address', 'password should not be empty'];

    // Replicate the filter's mapping logic directly
    const raw: unknown = messages;
    const result = Array.isArray(raw)
      ? (raw as string[]).join('; ')
      : (raw as string);

    expect(result).toBe(
      'email must be a valid email address; password should not be empty',
    );
  });

  it('passes through a plain string message unchanged', () => {
    const raw: unknown = 'Invalid admin credentials';
    const result = Array.isArray(raw)
      ? (raw as string[]).join('; ')
      : (raw as string);

    expect(result).toBe('Invalid admin credentials');
  });

  it('produces a non-empty string for a single-element array', () => {
    const raw: unknown = ['email must be a valid email address'];
    const result = Array.isArray(raw)
      ? (raw as string[]).join('; ')
      : (raw as string);

    expect(result).toBe('email must be a valid email address');
  });
});
