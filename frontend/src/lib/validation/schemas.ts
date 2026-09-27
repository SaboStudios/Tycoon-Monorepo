/**
 * Shared validation schemas — mirrors backend DTO rules.
 *
 * Backend alignment:
 *  - LoginDto        : email (IsEmail, IsNotEmpty), password (IsString, IsNotEmpty)
 *  - AdminLoginDto   : email (IsEmail), password (IsString, MinLength(6))
 *  - WalletLoginDto  : address (IsString, IsNotEmpty), chain (IsString, IsNotEmpty)
 *  - JoinRoom        : roomCode 6-char alphanumeric (enforced in JoinRoomForm)
 *  - GameSettings    : playerName non-empty, customStake positive number when applicable
 */
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const adminLoginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const walletLoginSchema = z.object({
  address: z.string().min(1, "Wallet address is required"),
  chain: z.string().min(1, "Chain is required"),
});

export const joinRoomSchema = z.object({
  roomCode: z
    .string()
    .length(6, "Room code must be exactly 6 characters")
    .regex(/^[A-Za-z0-9]+$/, "Room code must be letters and numbers only"),
});

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
