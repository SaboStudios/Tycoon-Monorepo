/**
 * Shared validation schemas — mirrors backend DTO rules.
 *
 * Backend alignment:
 *  - LoginDto        : email (IsEmail, IsNotEmpty), password (IsString, IsNotEmpty)
 *  - AdminLoginDto   : email (IsEmail), password (IsString, MinLength(6))
 *  - WalletLoginDto  : address (IsString, IsNotEmpty), chain (IsString, IsNotEmpty)
 *  - JoinRoom        : roomCode 6-char alphanumeric (enforced in JoinRoomForm)
 *  - GameSettings    : playerName non-empty, customStake positive number when applicable
 *
 * Tree-shake optimized: each schema is a pure function, only included if imported.
 */
import { z } from "zod";
import { JOIN_ROOM_I18N } from "@/lib/join-room/i18n-keys";

/* @__PURE__ */
export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

/* @__PURE__ */
export const adminLoginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

/* @__PURE__ */
export const walletLoginSchema = z.object({
  address: z.string().min(1, "Wallet address is required"),
  chain: z.string().min(1, "Chain is required"),
});

/* @__PURE__ */
export const joinRoomSchema = z.object({
  roomCode: z
    .string()
    // Normalise before validation: trim whitespace and uppercase so the server
    // always receives a clean, canonical code regardless of how the user typed it.
    .transform((v) => v.trim().toUpperCase())
    .pipe(
      z
        .string()
        .length(6, JOIN_ROOM_I18N.validation.codeLength)
        .regex(/^[A-Z0-9]+$/, JOIN_ROOM_I18N.validation.codeFormat)
    ),
});

/** Optional invite token from deep links — URL-safe alphanumeric. */
/* @__PURE__ */
export const inviteTokenSchema = z
  .string()
  .transform((v) => v.trim())
  .pipe(
    z
      .string()
      .min(8, "Invite token must be at least 8 characters")
      .max(64, "Invite token is too long")
      .regex(/^[A-Za-z0-9_-]+$/, "Invite token contains invalid characters")
  );

/** Optional display name shown in the waiting room lobby. */
/* @__PURE__ */
export const displayNameSchema = z
  .string()
  .transform((v) => v.trim())
  .pipe(
    z
      .string()
      .min(1, "Display name is required")
      .max(32, "Display name must be 32 characters or fewer")
      .regex(
        /^[\p{L}\p{N}\s'.-]+$/u,
        "Display name contains invalid characters"
      )
  );

/* @__PURE__ */
export const gameSettingsSchema = z.object({
  playerName: z.string().min(1, "Host name is required").max(32, "Max 32 characters"),
  customStake: z
    .string()
    .optional()
    .refine((v) => v === undefined || v === "" || (!isNaN(Number(v)) && Number(v) > 0), {
      message: "Must be a positive number",
    }),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
export type AdminLoginFormValues = z.infer<typeof adminLoginSchema>;
export type WalletLoginFormValues = z.infer<typeof walletLoginSchema>;
export type JoinRoomFormValues = z.infer<typeof joinRoomSchema>;
export type GameSettingsFormValues = z.infer<typeof gameSettingsSchema>;
