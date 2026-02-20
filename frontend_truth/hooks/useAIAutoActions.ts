// Replace your current useAIAutoActions hook with this improved version

import { useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { Game, Player, Property, GameProperty } from "@/types/game";
import { ApiResponse } from "@/types/api";

interface UseAIAutoActionsProps {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  me: Player | null;
  currentPlayer: Player | undefined;
  isAITurn: boolean;
  onRollDice: () => void; // We'll pass this from AiBoard
}

const COLOR_GROUPS = {
  brown: [1, 3],
  lightblue: [6, 8, 9],
  pink: [11, 13, 14],
  orange: [16, 18, 19],
  red: [21, 23, 24],
  yellow: [26, 27, 29],
  green: [31, 32, 34],
  darkblue: [37, 39],
};

export const useAIAutoActions = ({
  game,
  properties,
  game_properties,
  me,
  currentPlayer,
  isAITurn,
  onRollDice,
}: UseAIAutoActionsProps) => {
  const isAI = currentPlayer?.username?.toLowerCase().includes("ai") || false;

  // Helper: Get all properties owned by a player
  const getOwnedProperties = (player: Player) =>
    game_properties.filter(
      (gp) => gp.address?.toLowerCase() === player.address?.toLowerCase()
    );

  // 1. Liquidation when in debt
  const aiLiquidate = useCallback(async () => {
    if (!currentPlayer || currentPlayer.balance >= 0) return;

    toast(`AI ${currentPlayer.username} is in debt! Liquidating...`);

    // Sell houses first (most valuable rent first)
    const improved = game_properties
      .filter(
        (gp) =>
          gp.address?.toLowerCase() === currentPlayer.address?.toLowerCase() &&
          (gp.development ?? 0) > 0
      )
      .sort((a, b) => {
        const pa = properties.find((p) => p.id === a.property_id);
        const pb = properties.find((p) => p.id === b.property_id);
        return (pb?.rent_hotel || 0) - (pa?.rent_hotel || 0);
      });

    for (const gp of improved) {
      const prop = properties.find((p) => p.id === gp.property_id);
      if (!prop?.cost_of_house) continue;
      const houses = gp.development ?? 0;
      for (let i = 0; i < houses; i++) {
        try {
          await apiClient.post("/game-properties/downgrade", {
            game_id: game.id,
            user_id: currentPlayer.user_id,
            property_id: gp.property_id,
          });
          toast(`AI sold a house on ${prop.name}`);
        } catch (err) {
          console.error("AI downgrade failed", err);
          break;
        }
      }
    }

    // Then mortgage unmortgaged, non-improved properties
    const toMortgage = game_properties
      .filter(
        (gp) =>
          gp.address?.toLowerCase() === currentPlayer.address?.toLowerCase() &&
          !gp.mortgaged &&
          (gp.development ?? 0) === 0
      )
      .sort((a, b) => {
        const pa = properties.find((p) => p.id === a.property_id);
        const pb = properties.find((p) => p.id === b.property_id);
        return (pb?.price || 0) - (pa?.price || 0);
      });

    for (const gp of toMortgage) {
      const prop = properties.find((p) => p.id === gp.property_id);
      if (!prop?.price) continue;
      try {
        await apiClient.post("/game-properties/mortgage", {
          game_id: game.id,
          user_id: currentPlayer.user_id,
          property_id: gp.property_id,
        });
        toast(`AI mortgaged ${prop.name}`);
      } catch (err) {
        console.error("AI mortgage failed", err);
      }
    }
  }, [game.id, game_properties, properties, currentPlayer]);

  // 2. Build houses on complete monopolies
  const aiBuildHouses = useCallback(async () => {
    if (!currentPlayer || currentPlayer.balance < 600) return;

    const aiOwnedIds = getOwnedProperties(currentPlayer).map((gp) => gp.property_id);

    // Find complete color groups
    const completeGroups = Object.entries(COLOR_GROUPS).filter(([_, ids]) =>
      ids.every((id) => aiOwnedIds.includes(id))
    );

    if (completeGroups.length === 0) return;

    // Prioritize cheaper house costs + even building
    const buildCandidates = game_properties
      .filter(
        (gp) =>
          aiOwnedIds.includes(gp.property_id) &&
          !gp.mortgaged &&
          (gp.development ?? 0) < 5
      )
      .map((gp) => {
        const prop = properties.find((p) => p.id === gp.property_id);
        return { gp, prop, currentDev: gp.development ?? 0 };
      })
      .filter((item) => item.prop?.cost_of_house);

    if (buildCandidates.length === 0) return;

    // Find the lowest current development level in complete groups
    const minDevInMonopoly = Math.min(
      ...buildCandidates.map((c) => c.currentDev)
    );

    const target = buildCandidates
      .filter((c) => c.currentDev === minDevInMonopoly)
      .sort((a, b) => (a.prop?.cost_of_house || 0) - (b.prop?.cost_of_house || 0))[0];

    if (!target.prop || currentPlayer.balance < target.prop.cost_of_house) return;

    try {
      await apiClient.post("/game-properties/development", {
        game_id: game.id,
        user_id: currentPlayer.user_id,
        property_id: target.gp.property_id,
      });
      toast(`AI built a house on ${target.prop.name}!`);
    } catch (err) {
      console.error("AI build failed", err);
    }
  }, [game.id, game_properties, properties, currentPlayer]);

  // 3. Unmortgage valuable properties when rich
  const aiUnmortgage = useCallback(async () => {
    if (!currentPlayer || currentPlayer.balance < 1000) return;

    const mortgaged = game_properties
      .filter(
        (gp) =>
          gp.address?.toLowerCase() === currentPlayer.address?.toLowerCase() &&
          gp.mortgaged
      )
      .map((gp) => ({
        gp,
        prop: properties.find((p) => p.id === gp.property_id),
      }))
      .filter((item) => item.prop?.rent_site_only && item.prop.price)
      .sort((a, b) => (b.prop!.rent_site_only || 0) - (a.prop!.rent_site_only || 0));

    if (mortgaged.length === 0) return;

    const target = mortgaged[0];
    const cost = Math.floor((target.prop!.price / 2) * 1.1);
    if (currentPlayer.balance < cost) return;

    try {
      await apiClient.post("/game-properties/unmortgage", {
        game_id: game.id,
        user_id: currentPlayer.user_id,
        property_id: target.gp.property_id,
      });
      toast(`AI redeemed ${target.prop!.name} from mortgage!`);
    } catch (err) {
      console.error("AI unmortgage failed", err);
    }
  }, [game.id, game_properties, properties, currentPlayer]);

  // 4. Send smart trade to complete monopoly
  const aiSendMonopolyTrade = useCallback(async () => {
    if (!currentPlayer || !me || currentPlayer.balance < 300 || Math.random() > 0.6) return;

    const aiOwnedIds = getOwnedProperties(currentPlayer).map((gp) => gp.property_id);
    const humanOwnedIds = getOwnedProperties(me).map((gp) => gp.property_id);

    // Find groups where AI owns all but one
    let missingPropertyId: number | null = null;
    let groupColor = "";

    for (const [color, ids] of Object.entries(COLOR_GROUPS)) {
      const missing = ids.filter((id) => !aiOwnedIds.includes(id));
      if (missing.length === 1 && humanOwnedIds.includes(missing[0])) {
        missingPropertyId = missing[0];
        groupColor = color;
        break;
      }
    }

    if (!missingPropertyId) return;

    const targetProp = properties.find((p) => p.id === missingPropertyId);
    if (!targetProp?.price) return;

    // AI offers: one of its properties + cash
    const aiOfferProps = game_properties
      .filter((gp) => gp.address?.toLowerCase() === currentPlayer.address?.toLowerCase())
      .sort((a, b) => {
        const pa = properties.find((p) => p.id === a.property_id);
        const pb = properties.find((p) => p.id === b.property_id);
        return (pa?.price || 0) - (pb?.price || 0);
      });

    if (aiOfferProps.length === 0) return;

    const offerPropId = aiOfferProps[0].property_id;
    const offerProp = properties.find((p) => p.id === offerPropId);

    const cashOffer = Math.floor(targetProp.price * 0.7); // Fair: 70% cash + property

    const payload = {
      game_id: game.id,
      player_id: currentPlayer.user_id,
      target_player_id: me.user_id,
      offer_properties: [offerPropId],
      offer_amount: cashOffer,
      requested_properties: [missingPropertyId],
      requested_amount: 0,
      status: "pending",
    };

    try {
      const res = await apiClient.post<ApiResponse>("/game-trade-requests", payload);
      if (res?.data?.success) {
        toast.success(
          `AI offers ${offerProp?.name} + $${cashOffer} for your ${targetProp.name} (to complete ${groupColor} monopoly)!`,
          { duration: 8000 }
        );
      }
    } catch (err) {
      console.error("AI trade failed", err);
    }
  }, [game.id, game_properties, properties, currentPlayer, me]);

  // Main AI pre-roll logic
  const runAIPreTurn = useCallback(async () => {
    if (!isAITurn || !currentPlayer || !isAI) return;

    // Step 1: Liquidate if broke
    if (currentPlayer.balance < 0) {
      await aiLiquidate();
      // After liquidation, roll to continue
      setTimeout(onRollDice, 1500);
      return;
    }

    // Step 2: Unmortgage if rich
    if (currentPlayer.balance > 1200) {
      await aiUnmortgage();
    }

    // Step 3: Build houses if has monopoly
    const aiOwnedIds = getOwnedProperties(currentPlayer).map((gp) => gp.property_id);
    const hasMonopoly = Object.values(COLOR_GROUPS).some((ids) =>
      ids.every((id) => aiOwnedIds.includes(id))
    );

    if (hasMonopoly && currentPlayer.balance > 700) {
      await aiBuildHouses();
      setTimeout(onRollDice, 1200);
      return;
    }

    // Step 4: Try to complete a monopoly via trade
    await aiSendMonopolyTrade();

    // Step 5: Finally roll
    setTimeout(onRollDice, 1000);
  }, [
    isAITurn,
    currentPlayer,
    isAI,
    aiLiquidate,
    aiUnmortgage,
    aiBuildHouses,
    aiSendMonopolyTrade,
    onRollDice,
  ]);

  // Trigger when AI turn starts
  useEffect(() => {
    if (isAITurn && currentPlayer && isAI) {
      const timer = setTimeout(runAIPreTurn, 800);
      return () => clearTimeout(timer);
    }
  }, [isAITurn, currentPlayer?.user_id, runAIPreTurn]);
};