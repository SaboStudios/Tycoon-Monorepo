"use client";

import { useEffect, useCallback, useRef } from "react";
import { toast } from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { Game, GameProperty, Property, Player } from "@/types/game";
import { ApiResponse } from "@/types/api";
import { isAIPlayer } from "@/utils/gameUtils";
import { MONOPOLY_STATS, BUILD_PRIORITY } from "./constants";

interface UseMobileAiLogicParams {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  me: Player | null;
  currentGame: Game;
  currentGameProperties: GameProperty[];
  players: Player[];
  isAITurn: boolean;
  currentPlayer: Player | undefined;
  strategyRanThisTurn: boolean;
  setStrategyRanThisTurn: (v: boolean) => void;
  justLandedProperty: Property | null;
  isRolling: boolean;
  roll: { die1: number; die2: number; total: number } | null;
  actionLock: "ROLL" | "END" | null;
  hasMovementFinished: boolean;
  fetchUpdatedGame: (retryDelay?: number) => Promise<void>;
  showToast: (message: string, type?: "success" | "error" | "default") => void;
  ROLL_DICE: (forAI?: boolean) => void;
  END_TURN: () => void;
  landedPositionRef: React.MutableRefObject<number | null>;
}

export function useMobileAiLogic({
  game,
  properties,
  game_properties,
  currentGame,
  currentGameProperties,
  players,
  isAITurn,
  currentPlayer,
  strategyRanThisTurn,
  setStrategyRanThisTurn,
  justLandedProperty,
  isRolling,
  roll,
  actionLock,
  hasMovementFinished,
  fetchUpdatedGame,
  showToast,
  ROLL_DICE,
  END_TURN,
  landedPositionRef,
}: UseMobileAiLogicParams) {
  const getPlayerOwnedProperties = useCallback(
    (playerAddress: string | undefined) => {
      if (!playerAddress) return [];
      return currentGameProperties
        .filter((gp) => gp.address?.toLowerCase() === playerAddress.toLowerCase())
        .map((gp) => ({
          gp,
          prop: properties.find((p) => p.id === gp.property_id)!,
        }))
        .filter((item) => !!item.prop);
    },
    [currentGameProperties, properties]
  );

  const getCompleteMonopolies = useCallback(
    (playerAddress: string | undefined) => {
      if (!playerAddress) return [];
      const owned = getPlayerOwnedProperties(playerAddress);
      const monopolies: string[] = [];
      Object.entries(MONOPOLY_STATS.colorGroups).forEach(([groupName, ids]) => {
        if (groupName === "railroad" || groupName === "utility") return;
        const ownedInGroup = owned.filter((o) => ids.includes(o.prop.id));
        if (
          ownedInGroup.length === ids.length &&
          ownedInGroup.every((o) => !o.gp.mortgaged)
        ) {
          monopolies.push(groupName);
        }
      });
      return monopolies.sort(
        (a, b) => BUILD_PRIORITY.indexOf(a) - BUILD_PRIORITY.indexOf(b)
      );
    },
    [getPlayerOwnedProperties]
  );

  const handleAiBuilding = useCallback(
    async (player: Player) => {
      if (!player.address) return;
      const monopolies = getCompleteMonopolies(player.address);
      if (monopolies.length === 0) return;
      let built = false;
      for (const groupName of monopolies) {
        const ids =
          MONOPOLY_STATS.colorGroups[
            groupName as keyof typeof MONOPOLY_STATS.colorGroups
          ];
        const groupGps = currentGameProperties.filter(
          (gp) =>
            ids.includes(gp.property_id) && gp.address === player.address
        );
        const developments = groupGps.map((gp) => gp.development ?? 0);
        const minHouses = Math.min(...developments);
        const maxHouses = Math.max(...developments);
        if (maxHouses > minHouses + 1 || minHouses >= 5) continue;
        const prop = properties.find((p) => ids.includes(p.id))!;
        const houseCost = prop.cost_of_house ?? 0;
        if (houseCost === 0) continue;
        const affordable = Math.floor((player.balance ?? 0) / houseCost);
        if (affordable < ids.length) continue;
        for (const gp of groupGps.filter(
          (g) => (g.development ?? 0) === minHouses
        )) {
          try {
            await apiClient.post("/game-properties/development", {
              game_id: currentGame.id,
              user_id: player.user_id,
              property_id: gp.property_id,
            });
            built = true;
            await new Promise((r) => setTimeout(r, 900));
          } catch (err) {
            console.error("Build failed", err);
            break;
          }
        }
        if (built) {
          await fetchUpdatedGame();
          break;
        }
      }
    },
    [
      currentGame.id,
      currentGameProperties,
      getCompleteMonopolies,
      properties,
      fetchUpdatedGame,
    ]
  );

  const handleAiBuyDecision = useCallback(async () => {
    if (
      !isAITurn ||
      !justLandedProperty ||
      !justLandedProperty.price ||
      !currentPlayer
    )
      return;
    const isOwned = currentGameProperties.some(
      (gp) => gp.property_id === justLandedProperty.id
    );
    if (isOwned || justLandedProperty.type !== "property") return;
    const balance = currentPlayer.balance ?? 0;
    const price = justLandedProperty.price;
    const ownedInGroup = getPlayerOwnedProperties(currentPlayer.address).filter(
      (o) =>
        Object.entries(MONOPOLY_STATS.colorGroups).some(
          ([_, ids]) =>
            ids.includes(o.prop.id) && ids.includes(justLandedProperty.id)
        )
    ).length;
    const groupSize =
      Object.values(MONOPOLY_STATS.colorGroups).find((ids) =>
        ids.includes(justLandedProperty.id)
      )?.length || 0;
    const completesMonopoly =
      groupSize > 0 && ownedInGroup === groupSize - 1;
    const goodLandingRank =
      (MONOPOLY_STATS.landingRank[justLandedProperty.id] ?? 99) <= 15;
    const affordable = balance >= price + 200;
    const shouldBuy = completesMonopoly || (goodLandingRank && affordable);
    if (shouldBuy) {
      try {
        await apiClient.post("/game-properties/buy", {
          user_id: currentPlayer.user_id,
          game_id: currentGame.id,
          property_id: justLandedProperty.id,
        });
        await fetchUpdatedGame();
      } catch (err) {
        console.error("AI purchase failed", err);
      }
    }
    landedPositionRef.current = null;
  }, [
    isAITurn,
    justLandedProperty,
    currentPlayer,
    currentGameProperties,
    currentGame.id,
    fetchUpdatedGame,
    getPlayerOwnedProperties,
    landedPositionRef,
  ]);

  const getNearCompleteOpportunities = useCallback(
    (
      playerAddress: string | undefined,
      gps: GameProperty[],
      props: Property[]
    ) => {
      if (!playerAddress) return [];
      const owned = getPlayerOwnedProperties(playerAddress);
      const opportunities: {
        group: string;
        needs: number;
        missing: {
          id: number;
          name: string;
          ownerAddress: string | null;
          ownerName: string;
        }[];
      }[] = [];
      Object.entries(MONOPOLY_STATS.colorGroups).forEach(([groupName, ids]) => {
        if (groupName === "railroad" || groupName === "utility") return;
        const ownedCount = owned.filter((o) => ids.includes(o.prop.id)).length;
        const needs = ids.length - ownedCount;
        if (needs === 1 || needs === 2) {
          const missing = ids
            .filter((id) => !owned.some((o) => o.prop.id === id))
            .map((id) => {
              const gp = gps.find((g) => g.property_id === id);
              const prop = props.find((p) => p.id === id)!;
              const ownerName = gp?.address
                ? players.find(
                    (p) =>
                      p.address?.toLowerCase() === gp.address?.toLowerCase()
                  )?.username || gp.address.slice(0, 8)
                : "Bank";
              return {
                id,
                name: prop.name,
                ownerAddress: gp?.address || null,
                ownerName,
              };
            });
          opportunities.push({ group: groupName, needs, missing });
        }
      });
      return opportunities.sort((a, b) => {
        if (a.needs !== b.needs) return a.needs - b.needs;
        return BUILD_PRIORITY.indexOf(a.group) - BUILD_PRIORITY.indexOf(b.group);
      });
    },
    [getPlayerOwnedProperties, players]
  );

  const calculateTradeFavorability = useCallback(
    (
      trade: {
        offer_properties: number[];
        offer_amount: number;
        requested_properties: number[];
        requested_amount: number;
      },
      receiverAddress: string
    ) => {
      let score = 0;
      score += trade.offer_amount - trade.requested_amount;
      trade.requested_properties.forEach((id) => {
        const prop = properties.find((p) => p.id === id);
        if (!prop) return;
        score += prop.price || 0;
        const group = Object.values(MONOPOLY_STATS.colorGroups).find((g) =>
          g.includes(id)
        );
        if (group && !["railroad", "utility"].includes(prop.color!)) {
          const currentOwned = group.filter((gid) =>
            game_properties.find(
              (gp) =>
                gp.property_id === gid && gp.address === receiverAddress
            )
          ).length;
          if (currentOwned === group.length - 1) score += 300;
          else if (currentOwned === group.length - 2) score += 120;
        }
      });
      trade.offer_properties.forEach((id) => {
        const prop = properties.find((p) => p.id === id);
        if (!prop) return;
        score -= (prop.price || 0) * 1.3;
      });
      return score;
    },
    [properties, game_properties]
  );

  const calculateFairCashOffer = (
    propertyId: number,
    completesSet: boolean,
    basePrice: number
  ) =>
    completesSet ? Math.floor(basePrice * 1.6) : Math.floor(basePrice * 1.3);

  const getPropertyToOffer = useCallback(
    (playerAddress: string, excludeGroups: string[] = []) => {
      const owned = getPlayerOwnedProperties(playerAddress);
      const candidates = owned.filter((o) => {
        const group = Object.keys(MONOPOLY_STATS.colorGroups).find((g) =>
          MONOPOLY_STATS.colorGroups[
            g as keyof typeof MONOPOLY_STATS.colorGroups
          ].includes(o.prop.id)
        );
        if (!group || excludeGroups.includes(group)) return false;
        if (o.gp.development! > 0) return false;
        return true;
      });
      if (candidates.length === 0) return null;
      candidates.sort(
        (a, b) => (a.prop.price || 0) - (b.prop.price || 0)
      );
      return candidates[0];
    },
    [getPlayerOwnedProperties]
  );

  const handleAiStrategy = useCallback(async () => {
    if (!currentPlayer || !isAITurn || strategyRanThisTurn) return;
    showToast(`${currentPlayer.username} is thinking... 🧠`, "default");
    const opportunities = getNearCompleteOpportunities(
      currentPlayer.address,
      game_properties,
      properties
    );
    let maxTradeAttempts = 1;
    for (const opp of opportunities) {
      if (maxTradeAttempts <= 0) break;
      for (const missing of opp.missing) {
        if (!missing.ownerAddress || missing.ownerAddress === "bank") continue;
        const targetPlayer = players.find(
          (p) =>
            p.address?.toLowerCase() ===
            missing.ownerAddress?.toLowerCase()
        );
        if (!targetPlayer) continue;
        const basePrice =
          properties.find((p) => p.id === missing.id)?.price || 200;
        const cashOffer = calculateFairCashOffer(
          missing.id,
          opp.needs === 1,
          basePrice
        );
        let offerProperties: number[] = [];
        if ((currentPlayer.balance ?? 0) < cashOffer + 300) {
          const toOffer = getPropertyToOffer(currentPlayer.address!, [
            opp.group,
          ]);
          if (toOffer) {
            offerProperties = [toOffer.prop.id];
            showToast(`AI offering ${toOffer.prop.name} in deal`, "default");
          }
        }
        const payload = {
          game_id: game.id,
          player_id: currentPlayer.user_id,
          target_player_id: targetPlayer.user_id,
          offer_properties: offerProperties,
          offer_amount: cashOffer,
          requested_properties: [missing.id],
          requested_amount: 0,
        };
        try {
          const res = await apiClient.post<ApiResponse>(
            "/game-trade-requests",
            payload
          );
          if (res?.data?.success) {
            showToast(
              `AI offered $${cashOffer}${offerProperties.length ? " + property" : ""} for ${missing.name}`,
              "default"
            );
            maxTradeAttempts--;
            if (isAIPlayer(targetPlayer)) {
              await new Promise((r) => setTimeout(r, 800));
              const favorability = calculateTradeFavorability(
                { ...payload, requested_amount: 0 },
                targetPlayer.address!
              );
              if (favorability >= 50) {
                await apiClient.post("/game-trade-requests/accept", {
                  id: res.data.data.id,
                });
                showToast(
                  `${targetPlayer.username} accepted deal! 🤝`,
                  "success"
                );
                await fetchUpdatedGame();
              } else {
                await apiClient.post("/game-trade-requests/decline", {
                  id: res.data.data.id,
                });
                showToast(`${targetPlayer.username} declined`, "default");
              }
            } else {
              showToast(
                `Trade proposed to ${targetPlayer.username}`,
                "default"
              );
            }
          }
        } catch (err) {
          console.error("Trade failed", err);
        }
        await new Promise((r) => setTimeout(r, 1200));
      }
    }
    await handleAiBuilding(currentPlayer);
    setStrategyRanThisTurn(true);
    showToast(`${currentPlayer.username} ready to roll`, "default");
  }, [
    currentPlayer,
    isAITurn,
    strategyRanThisTurn,
    game.id,
    game_properties,
    properties,
    players,
    getNearCompleteOpportunities,
    getPropertyToOffer,
    calculateTradeFavorability,
    handleAiBuilding,
    setStrategyRanThisTurn,
    showToast,
    fetchUpdatedGame,
  ]);

  // Run AI strategy when it's AI turn
  useEffect(() => {
    if (isAITurn && currentPlayer && !strategyRanThisTurn) {
      const timer = setTimeout(handleAiStrategy, 1000);
      return () => clearTimeout(timer);
    }
  }, [isAITurn, currentPlayer, strategyRanThisTurn, handleAiStrategy]);

  // Auto roll for AI
  useEffect(() => {
    if (
      isAITurn &&
      !isRolling &&
      !roll &&
      !actionLock &&
      strategyRanThisTurn
    ) {
      const timer = setTimeout(() => ROLL_DICE(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [isAITurn, isRolling, roll, actionLock, strategyRanThisTurn, ROLL_DICE]);

  // AI buy decision after movement
  useEffect(() => {
    if (
      isAITurn &&
      hasMovementFinished &&
      roll &&
      landedPositionRef.current !== null
    ) {
      const timer = setTimeout(handleAiBuyDecision, 1200);
      return () => clearTimeout(timer);
    }
  }, [
    isAITurn,
    hasMovementFinished,
    roll,
    handleAiBuyDecision,
    landedPositionRef,
  ]);
}

export function useMobileAiBankruptcy({
  game,
  currentGame,
  currentGameProperties,
  players,
  isAITurn,
  currentPlayer,
  fetchUpdatedGame,
  setIsRaisingFunds,
  properties,
}: {
  game: Game;
  currentGame: Game;
  currentGameProperties: GameProperty[];
  players: Player[];
  isAITurn: boolean;
  currentPlayer: Player | undefined;
  fetchUpdatedGame: (retryDelay?: number) => Promise<void>;
  setIsRaisingFunds: (v: boolean) => void;
  properties: Property[];
}) {
  const processingBankruptcy = useRef<Set<number>>(new Set());

  const getGamePlayerId = useCallback(
    (walletAddress: string | undefined): number | null => {
      if (!walletAddress) return null;
      const ownedProp = currentGameProperties.find(
        (gp) =>
          gp.address?.toLowerCase() === walletAddress.toLowerCase()
      );
      return ownedProp?.player_id ?? null;
    },
    [currentGameProperties]
  );

  const aiSellHouses = useCallback(
    async (player: Player) => {
      const improved = currentGameProperties.filter(
        (gp) =>
          gp.address === player.address && (gp.development ?? 0) > 0
      );
      for (const gp of improved) {
        const prop = properties.find((p) => p.id === gp.property_id);
        if (!prop?.cost_of_house) continue;
        const houses = gp.development ?? 0;
        for (let i = 0; i < houses; i++) {
          try {
            await apiClient.post("/game-properties/downgrade", {
              game_id: currentGame.id,
              user_id: player.user_id,
              property_id: gp.property_id,
            });
            await new Promise((r) => setTimeout(r, 600));
          } catch (err) {
            console.error("AI failed to sell house", err);
            break;
          }
        }
      }
      await fetchUpdatedGame();
    },
    [currentGame.id, currentGameProperties, properties, fetchUpdatedGame]
  );

  const aiMortgageProperties = useCallback(
    async (player: Player) => {
      const unmortgaged = currentGameProperties.filter(
        (gp) =>
          gp.address === player.address &&
          !gp.mortgaged &&
          gp.development === 0
      );
      for (const gp of unmortgaged) {
        try {
          await apiClient.post("/game-properties/mortgage", {
            game_id: currentGame.id,
            user_id: player.user_id,
            property_id: gp.property_id,
          });
          await new Promise((r) => setTimeout(r, 600));
        } catch (err) {
          console.error("AI failed to mortgage", err);
        }
      }
      await fetchUpdatedGame();
    },
    [currentGame.id, currentGameProperties, fetchUpdatedGame]
  );

  useEffect(() => {
    if (
      !isAITurn ||
      !currentPlayer ||
      currentPlayer.balance >= 0 ||
      !isAIPlayer(currentPlayer) ||
      processingBankruptcy.current.has(currentPlayer.user_id)
    ) {
      return;
    }

    const handlePropertyTransfer = async (
      propertyId: number,
      newPlayerId: number
    ) => {
      try {
        const res = await apiClient.put<ApiResponse>(
          `/game-properties/${propertyId}`,
          { game_id: currentGame.id, player_id: newPlayerId }
        );
        return res.data?.success ?? false;
      } catch (err) {
        console.error("Transfer failed", err);
        return false;
      }
    };

    const handleDeleteGameProperty = async (id: number) => {
      try {
        const res = await apiClient.delete<ApiResponse>(
          `/game-properties/${id}`,
          { data: { game_id: currentGame.id } }
        );
        return res.data?.success ?? false;
      } catch (err) {
        console.error("Delete failed", err);
        return false;
      }
    };

    const handleAiBankruptcy = async () => {
      processingBankruptcy.current.add(currentPlayer.user_id);
      const mainToastId = toast.loading(
        `${currentPlayer.username} is bankrupt — eliminating...`,
        { duration: 15000 }
      );
      try {
        setIsRaisingFunds(true);
        await aiSellHouses(currentPlayer);
        await aiMortgageProperties(currentPlayer);
        await fetchUpdatedGame();
        const aiProps = currentGameProperties.filter(
          (gp) => gp.address === currentPlayer.address
        );
        const landedGp = currentGameProperties.find(
          (gp) => gp.property_id === currentPlayer.position
        );
        const creditorAddr =
          landedGp?.address && landedGp.address !== "bank"
            ? landedGp.address
            : null;
        const creditor = creditorAddr
          ? players.find(
              (p) =>
                p.address?.toLowerCase() === creditorAddr.toLowerCase()
            )
          : null;
        if (creditor && !isAIPlayer(creditor)) {
          const creditorId = getGamePlayerId(creditor.address);
          if (creditorId) {
            for (const prop of aiProps) {
              await handlePropertyTransfer(prop.id, creditorId);
            }
          } else {
            for (const prop of aiProps) {
              await handleDeleteGameProperty(prop.id);
            }
          }
        } else {
          for (const prop of aiProps) {
            await handleDeleteGameProperty(prop.id);
          }
        }
        await apiClient.post("/game-players/end-turn", {
          user_id: currentPlayer.user_id,
          game_id: currentGame.id,
        });
        await apiClient.post("/game-players/leave", {
          address: currentPlayer.address,
          code: game.code,
          reason: "bankruptcy",
        });
        await fetchUpdatedGame();
        toast.dismiss(mainToastId);
        toast.success(`${currentPlayer.username} has been eliminated.`, {
          duration: 6000,
        });
      } catch (err) {
        console.error("AI bankruptcy failed:", err);
        toast.dismiss(mainToastId);
        toast.error("Failed to process bankruptcy");
      } finally {
        setIsRaisingFunds(false);
        setTimeout(() => {
          processingBankruptcy.current.delete(currentPlayer.user_id);
        }, 5000);
      }
    };

    handleAiBankruptcy();
  }, [
    isAITurn,
    currentPlayer?.user_id,
    currentPlayer?.balance,
    currentPlayer?.address,
    currentPlayer?.position,
    game.code,
    currentGame.id,
    currentGameProperties,
    players,
    fetchUpdatedGame,
    setIsRaisingFunds,
    getGamePlayerId,
    aiSellHouses,
    aiMortgageProperties,
  ]);
}
