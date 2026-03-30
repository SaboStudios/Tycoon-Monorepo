import { registerAs } from '@nestjs/config';

export const nearConfig = registerAs('near', () => ({
  network: process.env.NEAR_NETWORK || 'testnet',
  rpcEndpoints: (process.env.NEAR_RPC_ENDPOINTS || 'https://rpc.testnet.near.org')
    .split(',')
    .map((url) => url.trim())
    .filter((url) => url.length > 0),
  timeoutMs: parseInt(process.env.NEAR_TIMEOUT_MS || '10000', 10),
}));
