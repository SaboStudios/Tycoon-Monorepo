import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ResetPasswordDto } from './reset-password.dto';

describe('ResetPasswordDto', () => {
  it('should accept valid password', async () => {
    const dto = plainToInstance(ResetPasswordDto, {
      newPassword: 'validPassword123',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should reject password shorter than 8 characters', async () => {
    const dto = plainToInstance(ResetPasswordDto, {
      newPassword: 'short',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('newPassword');
  });

  it('should reject non-string password', async () => {
    const dto = plainToInstance(ResetPasswordDto, {
      newPassword: 12345678,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
