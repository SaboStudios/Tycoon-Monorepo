import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NearService {
  private readonly logger = new Logger(NearService.name);
  private rpcEndpoints: string[];
  private timeoutMs: number;
  private currentRpcIndex = 0;

  constructor(private configService: ConfigService) {
    this.rpcEndpoints = this.configService.get<string[]>('near.rpcEndpoints') || ['https://rpc.testnet.near.org'];
    this.timeoutMs = this.configService.get<number>('near.timeoutMs') || 10000;
  }

  /**
   * Gets the currently active RPC endpoint.
   */
  get currentRpc(): string {
    return this.rpcEndpoints[this.currentRpcIndex % this.rpcEndpoints.length];
  }

  /**
   * Rotates to the next RPC endpoint in the list.
   */
  private rotateRpc(reason: string) {
    const oldRpc = this.currentRpc;
    this.currentRpcIndex++;
    const newRpc = this.currentRpc;
    this.logger.warn(`Rotating RPC endpoint from ${oldRpc} to ${newRpc} due to: ${reason}`);
  }

  /**
   * Core RPC call method handling retries, rotation, and timeout.
   */
  async rpcCall(method: string, params: any): Promise<any> {
    const maxRetries = this.rpcEndpoints.length;
    let attempts = 0;
    let lastError: any;

    while (attempts < maxRetries) {
      const endpoint = this.currentRpc;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'tycoon',
            method,
            params,
          }),
          signal: controller.signal,
        }).finally(() => clearTimeout(timeout));

        if (!response.ok) {
          throw new Error(`HTTP Error: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.error) {
          // A JSON-RPC error means the node is active but the request or contract failed.
          // In this case, there's no need to rotate to another RPC node.
          throw new Error(data.error.message || JSON.stringify(data.error));
        }

        return data.result;
      } catch (err: any) {
        lastError = err;
        
        // Always rotate on fetch failure (network issue, timeout, 5xx).
        // If it's a 400 or JSON-RPC error, we might not want to rotate, 
        // but simple assumption: if we hit catch, it's mostly network/timeout.
        // Wait, if we threw from data.error above, it's a JSON-RPC error. We shouldn't rotate.
        if (err.message && (err.message.includes('FunctionCallError') || err.message.includes('does not exist'))) {
            // contract error, just rethrow
            throw err;
        }

        this.rotateRpc(err.message);
        attempts++;
      }
    }

    this.logger.error(`All ${maxRetries} NEAR RPC endpoints failed.`);
    throw new Error(`All NEAR RPC endpoints failed. Last error: ${lastError?.message}`);
  }

  /**
   * Calls a view method on a NEAR smart contract.
   * @param contractId The NEAR account id of the smart contract.
   * @param methodName The view method to call.
   * @param args Optional arguments to pass to the method.
   */
  async view(contractId: string, methodName: string, args: Record<string, any> = {}): Promise<any> {
    const argsBase64 = Buffer.from(JSON.stringify(args)).toString('base64');

    const result = await this.rpcCall('query', {
      request_type: 'call_function',
      finality: 'final',
      account_id: contractId,
      method_name: methodName,
      args_base64: argsBase64,
    });

    if (result && result.result) {
      const resString = Buffer.from(result.result).toString('utf8');
      try {
        return JSON.parse(resString);
      } catch {
        return resString;
      }
    }

    return result;
  }

  /**
   * Broadcasts a signed transaction to the NEAR network.
   * Typically, frontend apps handle signing, so the backend just forwards the signed tx.
   * @param signedTransactionBase64 The base64-encoded signed transaction.
   */
  async broadcastTx(signedTransactionBase64: string): Promise<any> {
    return this.rpcCall('broadcast_tx_commit', [signedTransactionBase64]);
  }
}
