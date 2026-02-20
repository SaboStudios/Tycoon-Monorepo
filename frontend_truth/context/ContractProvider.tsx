'use client';

import { createContext, useContext, useCallback, useMemo } from 'react';
import {
  useReadContract,
  useReadContracts,
  useWriteContract,
  useAccount,
  useWaitForTransactionReceipt,
  useChainId,
} from 'wagmi';
import { Address } from 'viem';
import TycoonABI from './abi/tycoonabi.json';
import RewardABI from './abi/rewardabi.json';
import Erc20Abi from './abi/ERC20abi.json';
import { TYCOON_CONTRACT_ADDRESSES, REWARD_CONTRACT_ADDRESSES, USDC_TOKEN_ADDRESS, AI_AGENT_REGISTRY_ADDRESSES } from '@/constants/contracts';
import RegistryABI from './abi/tycoon-ai-registry-abi.json';

// Fixed stake amount (adjust if needed)
const STAKE_AMOUNT = 1; // 1 wei for testing? Or change to actual value like 0.01 ether = 10000000000000000n

/* ----------------------- Types (Matching New Contracts) ----------------------- */


type User = {
  id: bigint;
  username: string;
  playerAddress: Address;
  registeredAt: bigint;
  gamesPlayed: bigint;
  gamesWon: bigint;
  gamesLost: bigint;
  totalStaked: bigint;
  totalEarned: bigint;
  totalWithdrawn: bigint;
};
type UserTuple = [bigint, string, Address, bigint, bigint, bigint, bigint, bigint, bigint, bigint];

export type GameSettings = {
  maxPlayers: number;
  auction: boolean;
  rentInPrison: boolean;
  mortgage: boolean;
  evenBuild: boolean;
  startingCash: bigint;
  privateRoomCode: string;
};

type Game = {
  id: bigint;
  code: string;
  creator: Address;
  status: number;
  winner: Address;
  numberOfPlayers: number;
  joinedPlayers: number;
  mode: number;
  ai: boolean;
  createdAt: bigint;
  stakePerPlayer: bigint;
  endedAt: bigint;
  totalStaked: bigint;
};

type ExtendedGameData = Game;
type GameTuple = [bigint, string, Address, number, number, Address, number, number, number, boolean, bigint, bigint, bigint, bigint];

type GamePlayer = {
  gameId: bigint;
  playerAddress: Address;
  balance: bigint;
  position: number;
  order: number;
  symbol: number;
  username: string;
};
type GamePlayerTuple = [bigint, Address, bigint, number, number, number, string];

/* ----------------------- Reward System Types ----------------------- */

export enum CollectiblePerk {
  NONE,
  EXTRA_TURN,
  JAIL_FREE,
  DOUBLE_RENT,
  ROLL_BOOST,
  CASH_TIERED,
  TELEPORT,
  SHIELD,
  PROPERTY_DISCOUNT,
  TAX_REFUND,
  ROLL_EXACT,
}

export type RewardCollectibleInfo = {
  perk: CollectiblePerk;
  strength: bigint;
  tycPrice: bigint;
  usdcPrice: bigint;
  shopStock: bigint;
};

export const VOUCHER_ID_START = 1_000_000_000;
export const COLLECTIBLE_ID_START = 2_000_000_000;

export const isVoucherToken = (tokenId: bigint): boolean =>
  tokenId >= VOUCHER_ID_START && tokenId < COLLECTIBLE_ID_START;

export const isCollectibleToken = (tokenId: bigint): boolean =>
  tokenId >= COLLECTIBLE_ID_START;

/* ----------------------- Core Hooks ----------------------- */

export function useIsRegistered(address?: Address) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'registered',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!contractAddress },
  });

  return {
    data: result.data as boolean | undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useGetUsername(address?: Address) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'addressToUsername',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!contractAddress },
  });

  return {
    data: result.data as string | undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function usePreviousGameCode(address?: Address) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'previousGameCode',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!contractAddress },
  });

  return {
    data: result.data as string | undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useRegisterPlayer() {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const write = useCallback(
    async (username: string) => {
      if (!contractAddress) throw new Error('Contract not deployed on this chain');
      if (!username.trim()) throw new Error('Username cannot be empty');

      const hash = await writeContractAsync({
        address: contractAddress,
        abi: TycoonABI,
        functionName: 'registerPlayer',
        args: [username.trim()],
      });
      return hash;
    },
    [writeContractAsync, contractAddress]
  );

  return { write, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useCreateGame(
  creatorUsername: string,
  gameType: string,
  playerSymbol: string,
  numberOfPlayers: number,
  code: string,
  startingCash: bigint,
  stake: bigint,
) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const {
    writeContractAsync,
    isPending,
    error: writeError,
    data: txHash,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  const write = useCallback(async () => {
    if (!contractAddress) throw new Error('Contract not deployed');

    return writeContractAsync({
      address: contractAddress,
      abi: TycoonABI,
      functionName: 'createGame',
      args: [
        creatorUsername,
        gameType,
        playerSymbol,
        numberOfPlayers,
        code,
        startingCash,
        stake,
      ],
    });
  }, [
    writeContractAsync,
    contractAddress,
    creatorUsername,
    gameType,
    playerSymbol,
    numberOfPlayers,
    code,
    startingCash,
    stake,
  ]);

  return {
    write,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
    error: writeError,
    txHash,
    reset,
  };
}

export function useCreateAIGame(
  creatorUsername: string,
  gameType: string,
  playerSymbol: string,
  numberOfAI: number,
  code: string,
  startingCash: bigint,
) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const {
    writeContractAsync,
    isPending,
    error: writeError,
    data: txHash,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  const write = useCallback(async () => {
    if (!contractAddress) throw new Error('Contract not deployed');

    return writeContractAsync({
      address: contractAddress,
      abi: TycoonABI,
      functionName: 'createAIGame',
      args: [
        creatorUsername,
        gameType,
        playerSymbol,
        numberOfAI,
        code,
        startingCash,
      ],
    });
  }, [
    writeContractAsync,
    contractAddress,
    creatorUsername,
    gameType,
    playerSymbol,
    numberOfAI,
    code,
    startingCash,
  ]);

  return {
    write,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
    error: writeError,
    txHash,
    reset,
  };
}



export function useTransferPropertyOwnership() {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const {
    writeContractAsync,
    isPending,
    error: writeError,
    data: txHash,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  const write = useCallback(async (seller: string, buyer: string) => {
    if (!contractAddress) throw new Error('Contract not deployed');

    return writeContractAsync({
      address: contractAddress,
      abi: TycoonABI,
      functionName: 'transferPropertyOwnership',
      args: [
        seller,
        buyer
      ],
    });
  }, [
    writeContractAsync,
    contractAddress   
  ]);

  return {
    write,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
    error: writeError,
    txHash,
    reset,
  };
}



export function useJoinGame(gameId: bigint, username: string, playerSymbol: string, code: string, stake: bigint) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const write = useCallback(async () => {
    if (!contractAddress) throw new Error('Contract not deployed');
    const hash = await writeContractAsync({
      address: contractAddress,
      abi: TycoonABI,
      functionName: 'joinGame',
      args: [gameId, username, playerSymbol, code],
    });
    return hash;
  }, [writeContractAsync, contractAddress, gameId, username, playerSymbol, code]);

  return { write, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useEndAIGameAndClaim(gameId: bigint, finalPosition: number, finalBalance: bigint, isWin: boolean) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const write = useCallback(async () => {
    if (!contractAddress) throw new Error('Contract not deployed');
    const hash = await writeContractAsync({
      address: contractAddress,
      abi: TycoonABI,
      functionName: 'endAIGame',
      args: [gameId, finalPosition, finalBalance, isWin],
    });
    return hash;
  }, [writeContractAsync, contractAddress, gameId, finalPosition, finalBalance, isWin]);

  return { write, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

/** Params for one AI agent stats update (from frontend/backend after game end). */
export type AIAgentStatsUpdate = {
  agentAddress: Address;
  won: boolean;
  finalBalance: bigint;
  propertiesBought?: number;
  tradesProposed?: number;
  tradesAccepted?: number;
  housesBuilt?: number;
  hotelsBuilt?: number;
  wentBankrupt?: boolean;
};

/**
 * Update AI agent stats on the registry. Only works if connected wallet is the registry's statsUpdater.
 * Call after endAIGame succeeds. Alternatively have your backend (with updater key) call the registry.
 */
export function useUpdateAIAgentStats() {
  const chainId = useChainId();
  const registryAddress = AI_AGENT_REGISTRY_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const updateOne = useCallback(async (update: AIAgentStatsUpdate) => {
    if (!registryAddress) throw new Error('AI registry not configured');
    await writeContractAsync({
      address: registryAddress,
      abi: RegistryABI as never,
      functionName: 'updateAgentStats',
      args: [
        update.agentAddress,
        update.won,
        update.finalBalance,
        BigInt(update.propertiesBought ?? 0),
        BigInt(update.tradesProposed ?? 0),
        BigInt(update.tradesAccepted ?? 0),
        BigInt(update.housesBuilt ?? 0),
        BigInt(update.hotelsBuilt ?? 0),
        update.wentBankrupt ?? false,
      ],
    });
  }, [writeContractAsync, registryAddress]);

  const updateAll = useCallback(async (updates: AIAgentStatsUpdate[]) => {
    for (const u of updates) await updateOne(u);
  }, [updateOne]);

  return { updateOne, updateAll, isPending: isPending || isConfirming, isSuccess, error: writeError, txHash, reset };
}

/** One registered AI agent from the on-chain registry */
export type RegisteredAIAgent = {
  tokenId: number;
  name: string;
  playStyle: string;
  difficultyLevel: number;
  agentAddress: Address;
};

/**
 * Fetch all registered AI agents from the registry (for game settings / agent picker).
 */
export function useRegisteredAIAgents() {
  const chainId = useChainId();
  const registryAddress = AI_AGENT_REGISTRY_ADDRESSES[chainId];

  const { data: tokenIds, isLoading: isLoadingIds } = useReadContract({
    address: registryAddress as Address,
    abi: RegistryABI as never,
    functionName: 'getAllAgents',
    query: { enabled: !!registryAddress },
  });

  const ids = useMemo(() => {
    if (!tokenIds || !Array.isArray(tokenIds)) return [];
    return (tokenIds as bigint[]).map((id) => Number(id));
  }, [tokenIds]);

  const contracts = useMemo(
    () =>
      ids.map((id) => ({
        address: registryAddress as Address,
        abi: RegistryABI as never,
        functionName: 'getAgent' as const,
        args: [id] as [number],
      })),
    [registryAddress, ids]
  );

  const { data: agentsResults, isLoading: isLoadingAgents } = useReadContracts({
    contracts,
    query: { enabled: !!registryAddress && ids.length > 0 },
  });

  const agents = useMemo((): RegisteredAIAgent[] => {
    if (!agentsResults || agentsResults.length !== ids.length) return [];
    return ids.map((id, i) => {
      const r = agentsResults[i] as { result?: unknown } | undefined;
      if (!r?.result || !Array.isArray(r.result)) return null;
      const [name, playStyle, difficultyLevel, agentAddress] = r.result as [string, string, number, Address, unknown, unknown];
      return { tokenId: id, name, playStyle, difficultyLevel, agentAddress };
    }).filter((a): a is RegisteredAIAgent => a != null);
  }, [agentsResults, ids]);

  return {
    agents,
    isLoading: isLoadingIds || isLoadingAgents,
    isSupported: !!registryAddress,
  };
}

export function useExitGame(gameId: bigint) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const exit = useCallback(async () => {
    if (!contractAddress) throw new Error('Contract not deployed');
    const hash = await writeContractAsync({
      address: contractAddress,
      abi: TycoonABI,
      functionName: 'exitGame',
      args: [gameId],
    });
    return hash;
  }, [writeContractAsync, contractAddress, gameId]);

  return { exit, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useClaimReward(gameId: bigint) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const claim = useCallback(async () => {
    if (!contractAddress) throw new Error('Contract not deployed');
    const hash = await writeContractAsync({
      address: contractAddress,
      abi: TycoonABI,
      functionName: 'claimReward',
      args: [gameId],
    });
    return hash;
  }, [writeContractAsync, contractAddress, gameId]);

  return { claim, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useGetUser(username?: string) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'getUser',
    args: username ? [username] : undefined,
    query: { enabled: !!username && !!contractAddress },
  });

  return {
    data: result.data ? {
      id: (result.data as UserTuple)[0],
      username: (result.data as UserTuple)[1],
      playerAddress: (result.data as UserTuple)[2],
      registeredAt: (result.data as UserTuple)[3],
      gamesPlayed: (result.data as UserTuple)[4],
      gamesWon: (result.data as UserTuple)[5],
      gamesLost: (result.data as UserTuple)[6],
      totalStaked: (result.data as UserTuple)[7],
      totalEarned: (result.data as UserTuple)[8],
      totalWithdrawn: (result.data as UserTuple)[9],
    } : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useGetGame(gameId?: bigint) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'getGame',
    args: gameId !== undefined ? [gameId] : undefined,
    query: { enabled: gameId !== undefined && !!contractAddress },
  });

  return {
    data: result.data ? {
      id: (result.data as GameTuple)[0],
      code: (result.data as GameTuple)[1],
      creator: (result.data as GameTuple)[2],
      status: (result.data as GameTuple)[3],
      winner: (result.data as GameTuple)[5],
      numberOfPlayers: (result.data as GameTuple)[6],
      joinedPlayers: (result.data as GameTuple)[7],
      mode: (result.data as GameTuple)[8],
      ai: (result.data as GameTuple)[9],
      createdAt: (result.data as GameTuple)[10],
      endedAt: (result.data as GameTuple)[11],
      totalStaked: (result.data as GameTuple)[12],
      stakePerPlayer: (result.data as GameTuple)[13],
    } : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useGetGameByCode(code?: string, options = { enabled: true }) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];
  const result = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'getGameByCode',
    args: code ? [code] : undefined,
    query: {
      enabled: options.enabled && !!contractAddress,
      retry: false,
    },
  });

  let gameData: ExtendedGameData | undefined;

  if (result.data && typeof result.data === 'object') {
    const d = result.data as Record<string, unknown>;
    gameData = {
      id: BigInt(d.id as string),
      code: String(d.code),
      creator: d.creator as Address,
      status: Number(d.status),
      winner: d.winner as Address,
      numberOfPlayers: Number(d.numberOfPlayers),
      joinedPlayers: Number(d.joinedPlayers),
      mode: Number(d.mode),
      ai: Boolean(d.ai),
      stakePerPlayer: BigInt(d.stakePerPlayer as string),
      totalStaked: BigInt(d.totalStaked as string),  // New
      createdAt: BigInt(d.createdAt as string),
      endedAt: BigInt(d.endedAt as string),
    };
  }

  return { data: gameData, isLoading: result.isLoading, error: result.error };
}
export function useGetGamePlayerByAddress(gameId?: bigint, playerAddress?: Address) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'getGamePlayer',
    args: gameId !== undefined && playerAddress ? [gameId, playerAddress] : undefined,
    query: { enabled: gameId !== undefined && !!playerAddress && !!contractAddress },
  });

  return {
    data: result.data ? {
      gameId: (result.data as GamePlayerTuple)[0],
      playerAddress: (result.data as GamePlayerTuple)[1],
      balance: (result.data as GamePlayerTuple)[2],
      position: (result.data as GamePlayerTuple)[3],
      order: (result.data as GamePlayerTuple)[4],
      symbol: (result.data as GamePlayerTuple)[5],
      username: (result.data as GamePlayerTuple)[6],
    } : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useTotalUsers() {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'totalUsers',
    query: { enabled: !!contractAddress },
  });

  return {
    data: result.data ? BigInt(result.data as bigint) : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useTotalGames() {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'totalGames',
    query: { enabled: !!contractAddress },
  });

  return {
    data: result.data ? BigInt(result.data as bigint) : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

/* ----------------------- Reward System Hooks ----------------------- */

export function useRewardCollectibleInfo(tokenId?: bigint) {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: 'getCollectibleInfo',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined && !!contractAddress },
  });

  return {
    data: result.data ? {
      perk: Number((result.data as any)[0]) as CollectiblePerk,
      strength: BigInt((result.data as any)[1]),
      tycPrice: BigInt((result.data as any)[2]),
      usdcPrice: BigInt((result.data as any)[3]),
      shopStock: BigInt((result.data as any)[4]),
    } : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useRewardGetCashTierValue(tier?: number) {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: 'getCashTierValue',
    args: tier !== undefined ? [tier] : undefined,
    query: { enabled: tier !== undefined && !!contractAddress },
  });

  return {
    data: result.data ? BigInt(result.data as bigint) : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useRewardTokenBalance(address?: Address, tokenId?: bigint) {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: 'balanceOf',
    args: address && tokenId !== undefined ? [address, tokenId] : undefined,
    query: { enabled: !!address && tokenId !== undefined && !!contractAddress },
  });

  return {
    balance: result.data ? BigInt(result.data as bigint) : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useRewardRedeemVoucher() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const redeem = useCallback(async (tokenId: bigint) => {
    if (!contractAddress) throw new Error('Reward contract not deployed');
    if (!isVoucherToken(tokenId)) throw new Error('Invalid voucher token ID');
    return await writeContractAsync({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'redeemVoucher',
      args: [tokenId],
    });
  }, [writeContractAsync, contractAddress]);

  return { redeem, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useRewardBurnCollectible() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const burn = useCallback(async (tokenId: bigint) => {
    if (!contractAddress) throw new Error('Reward contract not deployed');
    if (!isCollectibleToken(tokenId)) throw new Error('Invalid collectible token ID');
    return await writeContractAsync({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'burnCollectibleForPerk',
      args: [tokenId],
    });
  }, [writeContractAsync, contractAddress]);

  return { burn, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useRewardBuyCollectible() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const buy = useCallback(async (tokenId: bigint, useUsdc = false) => {
    if (!contractAddress) throw new Error('Reward contract not deployed');
    return await writeContractAsync({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'buyCollectible',
      args: [tokenId, useUsdc],
    });
  }, [writeContractAsync, contractAddress]);

  return { buy, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useApprove() {
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } =
    useWriteContract();

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  const approve = useCallback(
    async (
      contractAddress: Address,
      spender: Address,
      amount: bigint
    ) => {
      if (!contractAddress) throw new Error('Reward contract not deployed');

      return await writeContractAsync({
        address: contractAddress,
        abi: Erc20Abi,
        functionName: 'approve',
        args: [spender, amount],
      });
    },
    [writeContractAsync]
  );

  return {
    approve,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
    error: writeError,
    txHash,
    reset,
  };
}


/* ----------------------- New Reward View Hooks (from updated contract) ----------------------- */
export function useAllowance(
  owner?: Address,
  spender?: Address
) {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: Erc20Abi,
    functionName: 'allowance',
    args: owner && spender ? [owner, spender] : undefined,
    query: {
      enabled: !!owner && !!spender && !!contractAddress,
    },
  });

  return {
    data: result.data as bigint | undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useRewardOwnedTokenCount(address?: Address) {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: 'ownedTokenCount',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!contractAddress },
  });

  return {
    data: result.data ? BigInt(result.data as bigint) : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useRewardTokenOfOwnerByIndex(address?: Address, index?: bigint) {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: 'tokenOfOwnerByIndex',
    args: address && index !== undefined ? [address, index] : undefined,
    query: { enabled: !!address && index !== undefined && !!contractAddress },
  });

  return {
    data: result.data ? BigInt(result.data as bigint) : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}



/* ----------------------- Admin Reward Hooks ----------------------- */

export function useRewardSetBackendMinter() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const setMinter = useCallback(async (newMinter: Address) => {
    if (!contractAddress) throw new Error('Reward contract not deployed');
    return await writeContractAsync({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'setBackendMinter',
      args: [newMinter],
    });
  }, [writeContractAsync, contractAddress]);

  return { setMinter, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useRewardMintVoucher() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const mint = useCallback(async (to: Address, tycValue: bigint) => {
    if (!contractAddress) throw new Error('Reward contract not deployed');
    return await writeContractAsync({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'mintVoucher',
      args: [to, tycValue],
    });
  }, [writeContractAsync, contractAddress]);

  return { mint, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useRewardMintCollectible() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const mint = useCallback(async (to: Address, perk: CollectiblePerk, strength: number) => {
    if (!contractAddress) throw new Error('Reward contract not deployed');
    return await writeContractAsync({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'mintCollectible',
      args: [to, BigInt(perk), BigInt(strength)],
    });
  }, [writeContractAsync, contractAddress]);

  return { mint, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useRewardStockShop() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const stock = useCallback(async (amount: number, perk: CollectiblePerk, strength: number, tycPrice = 0, usdcPrice = 0) => {
    if (!contractAddress) throw new Error('Reward contract not deployed');
    return await writeContractAsync({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'stockShop',
      args: [BigInt(amount), BigInt(perk), BigInt(strength), tycPrice, usdcPrice],
    });
  }, [writeContractAsync, contractAddress]);

  return { stock, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useRewardRestockCollectible() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const restock = useCallback(async (tokenId: bigint, amount: bigint) => {
    if (!contractAddress) throw new Error('Reward contract not deployed');
    return await writeContractAsync({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'restockCollectible',
      args: [tokenId, amount],
    });
  }, [writeContractAsync, contractAddress]);

  return { restock, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useRewardUpdateCollectiblePrices() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const update = useCallback(async (tokenId: bigint, tycPrice: bigint, usdcPrice: bigint) => {
    if (!contractAddress) throw new Error('Reward contract not deployed');
    return await writeContractAsync({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'updateCollectiblePrices',
      args: [tokenId, tycPrice, usdcPrice],
    });
  }, [writeContractAsync, contractAddress]);

  return { update, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useRewardPause() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const pause = useCallback(async () => {
    if (!contractAddress) throw new Error('Reward contract not deployed');
    return await writeContractAsync({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'pause',
    });
  }, [writeContractAsync, contractAddress]);

  const unpause = useCallback(async () => {
    if (!contractAddress) throw new Error('Reward contract not deployed');
    return await writeContractAsync({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'unpause',
    });
  }, [writeContractAsync, contractAddress]);

  return { pause, unpause, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useRewardWithdrawFunds() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const withdraw = useCallback(async (token: Address, to: Address, amount: bigint) => {
    if (!contractAddress) throw new Error('Reward contract not deployed');
    return await writeContractAsync({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'withdrawFunds',
      args: [token, to, amount],
    });
  }, [writeContractAsync, contractAddress]);

  return { withdraw, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

/* ----------------------- Tycoon (main game) admin – owner only ----------------------- */

export function useTycoonAdminReads() {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const minStake = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'minStake',
    query: { enabled: !!contractAddress },
  });
  const minTurnsForPerks = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'minTurnsForPerks',
    query: { enabled: !!contractAddress },
  });
  const backendGameController = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'backendGameController',
    query: { enabled: !!contractAddress },
  });
  const tycoonOwner = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'owner',
    query: { enabled: !!contractAddress },
  });

  return {
    minStake: minStake.data as bigint | undefined,
    minTurnsForPerks: minTurnsForPerks.data as bigint | undefined,
    backendGameController: backendGameController.data as Address | undefined,
    tycoonOwner: tycoonOwner.data as Address | undefined,
    isLoading: minStake.isLoading || minTurnsForPerks.isLoading || backendGameController.isLoading || tycoonOwner.isLoading,
  };
}

export function useTycoonSetMinStake() {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const setMinStake = useCallback(async (newMinStakeWei: bigint) => {
    if (!contractAddress) throw new Error('Tycoon contract not deployed');
    return await writeContractAsync({
      address: contractAddress,
      abi: TycoonABI,
      functionName: 'setMinStake',
      args: [newMinStakeWei],
    });
  }, [writeContractAsync, contractAddress]);

  return { setMinStake, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useTycoonSetMinTurnsForPerks() {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const setMinTurnsForPerks = useCallback(async (newMin: bigint) => {
    if (!contractAddress) throw new Error('Tycoon contract not deployed');
    return await writeContractAsync({
      address: contractAddress,
      abi: TycoonABI,
      functionName: 'setMinTurnsForPerks',
      args: [newMin],
    });
  }, [writeContractAsync, contractAddress]);

  return { setMinTurnsForPerks, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useTycoonSetBackendGameController() {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const setBackendGameController = useCallback(async (newController: Address) => {
    if (!contractAddress) throw new Error('Tycoon contract not deployed');
    return await writeContractAsync({
      address: contractAddress,
      abi: TycoonABI,
      functionName: 'setBackendGameController',
      args: [newController],
    });
  }, [writeContractAsync, contractAddress]);

  return { setBackendGameController, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

/* ----------------------- Context Provider ----------------------- */

type TycoonContextType = {
  registerPlayer: (username: string) => Promise<string | undefined>;
  redeemVoucher: (tokenId: bigint) => Promise<string>;
  burnCollectible: (tokenId: bigint) => Promise<string>;
  buyCollectible: (tokenId: bigint, useUsdc?: boolean) => Promise<string>;
};

const TycoonContext = createContext<TycoonContextType | undefined>(undefined);

export const TycoonProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { address: userAddress } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const chainId = useChainId();

  const registerPlayer = useCallback(async (username: string) => {
    const addr = TYCOON_CONTRACT_ADDRESSES[chainId];
    if (!userAddress || !addr) throw new Error('Wallet or contract not available');
    return await writeContractAsync({
      address: addr,
      abi: TycoonABI,
      functionName: 'registerPlayer',
      args: [username],
    });
  }, [userAddress, writeContractAsync, chainId]);

  const redeemVoucher = useCallback(async (tokenId: bigint) => {
    const addr = REWARD_CONTRACT_ADDRESSES[chainId];
    if (!addr) throw new Error('Reward contract not deployed');
    return await writeContractAsync({
      address: addr,
      abi: RewardABI,
      functionName: 'redeemVoucher',
      args: [tokenId],
    });
  }, [writeContractAsync, chainId]);

  const burnCollectible = useCallback(async (tokenId: bigint) => {
    const addr = REWARD_CONTRACT_ADDRESSES[chainId];
    if (!addr) throw new Error('Reward contract not deployed');
    return await writeContractAsync({
      address: addr,
      abi: RewardABI,
      functionName: 'burnCollectibleForPerk',
      args: [tokenId],
    });
  }, [writeContractAsync, chainId]);

  const buyCollectible = useCallback(async (tokenId: bigint, useUsdc = false) => {
    const addr = REWARD_CONTRACT_ADDRESSES[chainId];
    if (!addr) throw new Error('Reward contract not deployed');
    return await writeContractAsync({
      address: addr,
      abi: RewardABI,
      functionName: 'buyCollectible',
      args: [tokenId, useUsdc],
    });
  }, [writeContractAsync, chainId]);

  const value = useMemo(() => ({
    registerPlayer,
    redeemVoucher,
    burnCollectible,
    buyCollectible,
  }), [registerPlayer, redeemVoucher, burnCollectible, buyCollectible]);

  return <TycoonContext.Provider value={value}>{children}</TycoonContext.Provider>;
};

export const useTycoon = () => {
  const context = useContext(TycoonContext);
  if (!context) throw new Error('useTycoon must be used within TycoonProvider');
  return context;
};