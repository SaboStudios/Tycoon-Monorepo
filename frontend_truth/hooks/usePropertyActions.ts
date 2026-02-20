import { useCallback } from "react";
import { toast } from "react-hot-toast";
import { apiClient } from "@/lib/api"; // Assuming this is the correct import path
import { ApiResponse } from "@/types/api"; // Assuming this is the correct import path

export const usePropertyActions = (gameId: number, userId: number | undefined, isMyTurn: boolean) => {
  const handleDevelopment = useCallback(async (id: number) => {
    if (!isMyTurn || !userId) return;
    try {
      const res = await apiClient.post<ApiResponse>("/game-properties/development", {
        game_id: gameId,
        user_id: userId,
        property_id: id,
      });
      if (res?.data?.success) toast.success("Property developed successfully");
    } catch (error: any) {
      toast.error(error?.message || "Failed to develop property");
    }
  }, [gameId, userId, isMyTurn]);

  const handleDowngrade = useCallback(async (id: number) => {
    if (!isMyTurn || !userId) return;
    try {
      const res = await apiClient.post<ApiResponse>("/game-properties/downgrade", {
        game_id: gameId,
        user_id: userId,
        property_id: id,
      });
      if (res?.data?.success) toast.success("Property downgraded successfully");
      else toast.error(res.data?.message ?? "Failed to downgrade property");
    } catch (error: any) {
      toast.error(error?.message || "Failed to downgrade property");
    }
  }, [gameId, userId, isMyTurn]);

  const handleMortgage = useCallback(async (id: number) => {
    if (!isMyTurn || !userId) return;
    try {
      const res = await apiClient.post<ApiResponse>("/game-properties/mortgage", {
        game_id: gameId,
        user_id: userId,
        property_id: id,
      });
      if (res?.data?.success) toast.success("Property mortgaged successfully");
      else toast.error(res.data?.message ?? "Failed to mortgage property");
    } catch (error: any) {
      toast.error(error?.message || "Failed to mortgage property");
    }
  }, [gameId, userId, isMyTurn]);

  const handleUnmortgage = useCallback(async (id: number) => {
    if (!isMyTurn || !userId) return;
    try {
      const res = await apiClient.post<ApiResponse>("/game-properties/unmortgage", {
        game_id: gameId,
        user_id: userId,
        property_id: id,
      });
      if (res?.data?.success) toast.success("Property unmortgaged successfully");
      else toast.error(res.data?.message ?? "Failed to unmortgage property");
    } catch (error: any) {
      toast.error(error?.message || "Failed to unmortgage property");
    }
  }, [gameId, userId, isMyTurn]);

  return { handleDevelopment, handleDowngrade, handleMortgage, handleUnmortgage };
};