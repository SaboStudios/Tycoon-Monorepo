/**
 * Validation Module
 *
 * Provides Zod schemas for form validation and error mapping utilities
 * for converting server responses to field-level error messages.
 *
 * @example
 * ```ts
 * import { joinRoomSchema, mapServerErrors } from '@/lib/validation';
 *
 * const result = joinRoomSchema.safeParse({ roomCode: 'ABC123' });
 * if (!result.success) {
 *   const errors = mapServerErrors(result.error);
 * }
 * ```
 */

export {
  loginSchema,
  adminLoginSchema,
  walletLoginSchema,
  joinRoomSchema,
  inviteTokenSchema,
  displayNameSchema,
  gameSettingsSchema,
} from "./schemas";

export type {
  LoginFormValues,
  AdminLoginFormValues,
  WalletLoginFormValues,
  JoinRoomFormValues,
  GameSettingsFormValues,
} from "./schemas";

export { mapServerErrors } from "./serverErrorMap";
export type { FieldErrors } from "./serverErrorMap";
