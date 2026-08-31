import { registerAs } from '@nestjs/config';

export const emailConfig = registerAs('email', () => ({
  provider: process.env.EMAIL_PROVIDER || 'noop',
}));
