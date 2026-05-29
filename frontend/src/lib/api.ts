"use client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface ApiRequestOptions extends RequestInit {
  token?: string;
}

export async function apiRequest<T>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { token, ...init } = options;
  const headers = new Headers(init.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Something went wrong");
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export { apiClient } from "./api/client";
export type { RequestOptions } from "./api/client";
export {
  TycoonApiError,
  isApiError,
  isUnauthorized,
  isValidationError,
} from "./api/errors";
export type { ApiError, ApiErrorCode } from "./api/errors";
export type {
  AdminLoginDto,
  AuthTokensResponse,
  BuyPropertyDto,
  CreateGameDto,
  CreateGameSettingsDto,
  GameMode,
  GamePlayerResponse,
  GamePlayerSymbol,
  GameResponse,
  GameSettingsResponse,
  GameStatus,
  JoinGameDto,
  LockBalanceDto,
  LoginDto,
  PaginationDto,
  PaginatedResponse,
  PayRentDto,
  PayTaxDto,
  PurchaseResponse,
  RefreshTokenDto,
  Role,
  RollDiceDto,
  ShopItemResponse,
  ShopItemType,
  SortOrder,
  UnlockBalanceDto,
  UpdateGamePlayerDto,
  UpdateGameSettingsDto,
  UpdateTurnDto,
  UserInventoryResponse,
  UserResponse,
  WalletLoginDto,
} from "./api/types/dto";
