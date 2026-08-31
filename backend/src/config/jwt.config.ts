import { registerAs } from '@nestjs/config';

const parseExpiresIn = (
  value: string | undefined,
  defaultSeconds: number,
): number => {
  if (!value) return defaultSeconds;
  const match = value.match(/^(\d+)([smhd])$/);
  if (!match) return defaultSeconds;
  const num = parseInt(match[1], 10);
  switch (match[2]) {
    case 's':
      return num;
    case 'm':
      return num * 60;
    case 'h':
      return num * 60 * 60;
    case 'd':
      return num * 24 * 60 * 60;
    default:
      return defaultSeconds;
  }
};

export const jwtConfig = registerAs('jwt', () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be set in environment variables');
  }
  return {
    secret: process.env.JWT_SECRET,
    expiresIn: parseExpiresIn(process.env.JWT_EXPIRES_IN, 900), // 15 minutes
    refreshExpiresIn: parseExpiresIn(process.env.JWT_REFRESH_EXPIRES_IN, 604800), // 7 days
    clockTolerance: parseInt(process.env.JWT_CLOCK_SKEW_SECONDS || '60', 10), // 60 seconds default
  };
});
