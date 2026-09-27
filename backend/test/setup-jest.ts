import 'reflect-metadata';

// Set explicit JWT secret for test environment to prevent any default-secret fallbacks
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret-for-test-environment-only';
}

// Ensure NODE_ENV is set to test if not already
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}
