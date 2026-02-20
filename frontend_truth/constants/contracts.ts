// constants/contracts.ts
import { Address } from 'viem';
import { celo } from 'wagmi/chains';

// Celo only (Base support paused)
export const TYCOON_CONTRACT_ADDRESSES: Record<number, Address | undefined> = {
  [celo.id]: process.env.NEXT_PUBLIC_CELO as Address,
};
export const REWARD_CONTRACT_ADDRESSES: Record<number, Address | undefined> = {
  [celo.id]: process.env.NEXT_PUBLIC_CELO_REWARD as Address,
};
export const TYC_TOKEN_ADDRESS: Record<number, Address | undefined> = {
  [celo.id]: process.env.NEXT_PUBLIC_CELO_REWARD as Address,
};

export const USDC_TOKEN_ADDRESS: Record<number, Address | undefined> = {
  [celo.id]: process.env.NEXT_PUBLIC_CELO_USDC as Address,
};

export const AI_AGENT_REGISTRY_ADDRESSES: Record<number, Address | undefined> = {
  [celo.id]: process.env.NEXT_PUBLIC_CELO_AI_REGISTRY as Address,
};

// constants/contracts.ts
export const MINIPAY_CHAIN_IDS = [42220]; // Celo Mainnet & Alfajores