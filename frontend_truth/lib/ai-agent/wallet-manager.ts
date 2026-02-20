// lib/ai-agent/wallet-manager.ts
// SERVER-ONLY: Use only in API routes or server modules. Do not import in client components.
// AI_PLAYER_*_PRIVATE_KEY and CELO_RPC_URL must be server env vars (never NEXT_PUBLIC_*).
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo, celoAlfajores } from 'viem/chains';
import { viem } from '@goat-sdk/wallet-viem';
import { getOnChainTools } from '@goat-sdk/adapter-vercel-ai';

const AI_WALLETS = {
  2: process.env.AI_PLAYER_2_PRIVATE_KEY!,
  3: process.env.AI_PLAYER_3_PRIVATE_KEY!,
  4: process.env.AI_PLAYER_4_PRIVATE_KEY!,
  5: process.env.AI_PLAYER_5_PRIVATE_KEY!,
  6: process.env.AI_PLAYER_6_PRIVATE_KEY!,
  7: process.env.AI_PLAYER_7_PRIVATE_KEY!,
  8: process.env.AI_PLAYER_8_PRIVATE_KEY!,
};

export class AIWalletManager {
  private wallets: Map<number, any> = new Map();
  private chain = process.env.NODE_ENV === 'production' ? celo : celoAlfajores;

  constructor() {
    this.initializeWallets();
  }

  private initializeWallets() {
    Object.entries(AI_WALLETS).forEach(([order, privateKey]) => {
      if (!privateKey) return;

      const account = privateKeyToAccount(privateKey as `0x${string}`);
      const walletClient = createWalletClient({
        account,
        transport: http(process.env.CELO_RPC_URL),
        chain: this.chain,
      });

      this.wallets.set(Number(order), walletClient);
    });
  }

  getWallet(aiOrder: number) {
    return this.wallets.get(aiOrder);
  }

  async getOnChainTools(aiOrder: number) {
    const wallet = this.getWallet(aiOrder);
    if (!wallet) throw new Error(`No wallet for AI ${aiOrder}`);

    return await getOnChainTools({
      wallet: viem(wallet),
      // Add any plugins you need (ERC20, NFT, etc.)
    });
  }
}