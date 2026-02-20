// lib/user.ts  (or wherever you keep utility functions)

import { apiClient } from "@/lib/api";
import { ApiResponse } from "@/types/api";

// Define the shape of your user object
export interface User {
  id?: number;
  username?: string;
  address?: string;
  chain?: string;
  games_played?: number;
  game_won?: number;
  game_lost?: number;
  total_staked?: string;
  total_earned?: string;
  total_withdrawn?: string;
  created_at?: string;
  updated_at?: string;
}

// Simple function to get the current user
export const getCurrentUser = async (address: string): Promise<User | null> => {
  if (!address) return null;

  try {
    // Replace with your actual endpoint
    const res = await apiClient.get<ApiResponse>("/users/me");

    if (res?.data?.success && res.data.data) {
      return res.data.data;
    }

    return null;
  } catch (error) {
    console.error("Failed to fetch user:", error);
    return null;
  }
};