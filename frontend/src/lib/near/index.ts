/**
 * Public API for @/lib/near.
 *
 * Import exclusively from "@/lib/near" — never from sub-modules directly
 * (e.g. "@/lib/near/config"). Sub-modules are internal implementation details
 * and may change without notice.
 *
 * All exports are named so bundlers (webpack/turbopack) can tree-shake
 * unused symbols. No side-effect imports are present at module level.
 */

export {
  getNearNetworkId,
  isValidNearAccountId,
  getNearContractId,
  DEFAULT_FUNCTION_CALL_GAS,
} from "./config";

export {
  NEAR_SIGNATURE_REJECTED_MESSAGE,
  isLikelyUserRejectedError,
  nearErrorMessage,
} from "./errors";

export {
  getTransactionHashFromOutcome,
  isFinalExecutionSuccess,
} from "./execution";

export { getExplorerTransactionUrl } from "./explorer";

export {
  MAX_DEPOSIT_YOCTO,
  isDepositSafe,
  sanitizeErrorMessage,
} from "./security";

export {
  trackNearWalletConnected,
  trackNearWalletDisconnected,
  trackNearTxSubmitted,
  trackNearTxConfirmed,
  trackNearTxFailed,
} from "./telemetry";

export type { NearTxPhase, NearTxRecord } from "./types";
