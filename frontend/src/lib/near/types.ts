export type NearTxPhase = "pending" | "confirmed" | "failed";

export interface NearTxRecord {
  id: string;
  hash?: string;
  phase: NearTxPhase;
  methodName: string;
  contractId: string;
  errorMessage?: string;
  explorerUrl?: string;
}
