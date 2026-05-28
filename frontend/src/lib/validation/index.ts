/**
 * Validation Module
 *
 * Provides Zod schemas for form validation and error mapping utilities.
 * Optimized for tree-shaking: only export what's needed.
 *
 * @example
 * ```ts
 * import { joinRoomSchema, mapServerErrors } from '@/lib/validation';
 * ```
 */

// Re-export schemas
export {
  loginSchema,
  adminLoginSchema,
  walletLoginSchema,
  joinRoomSchema,
  inviteTokenSchema,
  displayNameSchema,
  gameSettingsSchema,
} from './schemas';

// Re-export schema types
export type {
  LoginFormValues,
  AdminLoginFormValues,
  WalletLoginFormValues,
  JoinRoomFormValues,
  GameSettingsFormValues,
} from './schemas';

// Re-export error mapping
export { mapServerErrors } from './serverErrorMap';
export type { FieldErrors } from './serverErrorMap';
