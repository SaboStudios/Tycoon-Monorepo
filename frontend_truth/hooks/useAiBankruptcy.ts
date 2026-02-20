// hooks/useAiBankruptcy.ts
import { useEffect } from "react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { Game, GameProperty, Player, Property } from "@/types/game";
import { isAIPlayer } from "@/utils/gameUtils";
import { ApiResponse } from "@/types/api";

interface UseAiBankruptcyProps {
  isAITurn: boolean;
  currentPlayer: Player | null;
  game_properties: GameProperty[];
  properties: Property[];
  game: Game;
}

export function useAiBankruptcy({
  isAITurn,
  currentPlayer,
  game_properties,
  properties,
  game,
}: UseAiBankruptcyProps) {
  // Helper to get real player_id from wallet address
  const getGamePlayerId = (walletAddress: string | undefined): number | null => {
    if (!walletAddress) return null;
    const ownedProp = game_properties.find(
      gp => gp.address?.toLowerCase() === walletAddress.toLowerCase()
    );
    return ownedProp?.player_id ?? null;
  };

  // AI: Sell houses
  const aiSellHouses = async (needed: number): Promise<number> => {
    const improved = game_properties
      .filter(gp => gp.address === currentPlayer?.address && (gp.development ?? 0) > 0)
      .sort((a, b) => {
        const pa = properties.find(p => p.id === a.property_id);
        const pb = properties.find(p => p.id === b.property_id);
        return (pb?.rent_hotel || 0) - (pa?.rent_hotel || 0);
      });

    let raised = 0;
    for (const gp of improved) {
      if (raised >= needed) break;
      const prop = properties.find(p => p.id === gp.property_id);
      if (!prop?.cost_of_house) continue;

      const sellValue = Math.floor(prop.cost_of_house / 2);
      const houses = gp.development ?? 0;

      for (let i = 0; i < houses && raised < needed; i++) {
        try {
          await apiClient.post("/game-properties/downgrade", {
            game_id: game.id,
            user_id: currentPlayer!.user_id,
            property_id: gp.property_id,
          });
          raised += sellValue;
          toast(`AI sold a house on ${prop.name} (raised $${raised})`);
        } catch (err) {
          console.error("AI failed to sell house", err);
          break;
        }
      }
    }
    return raised;
  };

  // AI: Mortgage properties
  const aiMortgageProperties = async (needed: number): Promise<number> => {
    const unmortgaged = game_properties
      .filter(gp => gp.address === currentPlayer?.address && !gp.mortgaged && gp.development === 0)
      .map(gp => ({ gp, prop: properties.find(p => p.id === gp.property_id) }))
      .filter(({ prop }) => prop?.price)
      .sort((a, b) => (b.prop?.price || 0) - (a.prop?.price || 0));

    let raised = 0;
    for (const { gp, prop } of unmortgaged) {
      if (raised >= needed || !prop) continue;
      const mortgageValue = Math.floor(prop.price / 2);
      try {
        await apiClient.post<ApiResponse>("/game-properties/mortgage", {
          game_id: game.id,
          user_id: currentPlayer!.user_id,
          property_id: gp.property_id,
        });
        raised += mortgageValue;
        toast(`AI mortgaged ${prop.name} (raised $${raised})`);
      } catch (err) {
        console.error("AI failed to mortgage", err);
      }
    }
    return raised;
  };

  // AI: Handle liquidation + possible bankruptcy
  useEffect(() => {
    if (!isAITurn || !currentPlayer || currentPlayer.balance >= 0) return;

    const handleAiLiquidationAndPossibleBankruptcy = async () => {
      toast(`${currentPlayer.username} cannot pay — attempting to raise funds...`);

      const raisedFromHouses = await aiSellHouses(Infinity);
      const raisedFromMortgages = await aiMortgageProperties(Infinity);
      const totalRaised = raisedFromHouses + raisedFromMortgages;

      // Survived?
      if (currentPlayer.balance >= 0) {
        toast.success(`${currentPlayer.username} raised $${totalRaised} and survived! 💪`);
        return;
      }

      // Still bankrupt
      toast(`${currentPlayer.username} still cannot pay — bankrupt!`);

      try {
        const landedGameProperty = game_properties.find(
          gp => gp.property_id === currentPlayer.position
        );

        const creditorAddress =
          landedGameProperty?.address && landedGameProperty.address !== "bank"
            ? landedGameProperty.address
            : null;

        const creditorPlayer = creditorAddress
          ? game.players.find(
              p => p.address?.toLowerCase() === creditorAddress.toLowerCase()
            )
          : null;

        const aiProperties = game_properties.filter(
          gp => gp.address === currentPlayer.address
        );

        let successCount = 0;

        if (creditorPlayer && !isAIPlayer(creditorPlayer)) {
          const creditorRealPlayerId = getGamePlayerId(creditorPlayer.address);

          if (!creditorRealPlayerId) {
            toast.error(`Cannot transfer: ${creditorPlayer.username} has no valid player_id`);
            for (const prop of aiProperties) {
              try {
                const res = await apiClient.delete<ApiResponse>(`/game-properties/${prop.id}`, {
                  data: { game_id: game.id },
                });
                if (res.data?.success) successCount++;
              } catch (err) {
                console.error(`Delete failed for ${prop.id}`, err);
              }
            }
          } else {
            toast(`Transferring properties to ${creditorPlayer.username}...`);
            for (const prop of aiProperties) {
              try {
                const res = await apiClient.put<ApiResponse>(`/game-properties/${prop.id}`, {
                  game_id: game.id,
                  player_id: creditorRealPlayerId,
                });
                if (res.data?.success) successCount++;
              } catch (err) {
                console.error(`Transfer failed for ${prop.id}`, err);
              }
            }
            toast.success(
              `${successCount}/${aiProperties.length} properties transferred to ${creditorPlayer.username}!`
            );
          }
        } else {
          toast(`Returning properties to bank...`);
          for (const prop of aiProperties) {
            try {
              const res = await apiClient.delete<ApiResponse>(`/game-properties/${prop.id}`, {
                data: { game_id: game.id },
              });
              if (res.data?.success) successCount++;
            } catch (err) {
              console.error(`Delete failed for ${prop.id}`, err);
            }
          }
          toast.success(`${successCount}/${aiProperties.length} properties returned to bank.`);
        }

        // Remove AI from game
        await apiClient.post("/game-players/leave", {
          address: currentPlayer.address,
          code: game.code,
          reason: "bankruptcy",
        });

        toast.success(`${currentPlayer.username} has been eliminated.`, { duration: 6000 });
      } catch (err: any) {
        console.error("Bankruptcy handling failed:", err);
        toast.error("AI bankruptcy process failed");
      }
    };

    handleAiLiquidationAndPossibleBankruptcy();
  }, [isAITurn, currentPlayer?.balance, currentPlayer, game_properties, properties, game]);
}