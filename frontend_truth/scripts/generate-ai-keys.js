#!/usr/bin/env node
/**
 * One-off script: generates 8 EVM private keys for AI players.
 * Run: node scripts/generate-ai-keys.js
 * Copy the output into your .env (server-side only). Do not commit .env.
 */
const { generatePrivateKey } = require('viem/accounts');
const { privateKeyToAccount } = require('viem/accounts');

console.log('# Add these to your .env (server only, never commit)\n');
for (let i = 1; i <= 8; i++) {
  const pk = generatePrivateKey();
  const account = privateKeyToAccount(pk);
  console.log(`AI_PLAYER_${i}_PRIVATE_KEY=${pk}`);
  console.log(`# AI_PLAYER_${i} address: ${account.address}\n`);
}
console.log('# CELO_RPC_URL=https://alfajores-forno.celo-testnet.org');
