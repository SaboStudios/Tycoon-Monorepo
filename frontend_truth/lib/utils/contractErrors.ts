/**
 * Shared utility to normalize contract/transaction error messages for toast display.
 * Matches the pattern used in the settings page for consistent UX.
 */
export function getContractErrorMessage(
  error: unknown,
  defaultMessage = "Transaction failed. Please try again."
): string {
  const e = error as {
    code?: number;
    message?: string;
    shortMessage?: string;
    cause?: { name?: string };
    response?: { status?: number; data?: { message?: string; error?: string } };
  };

  // User rejected / cancelled (wagmi/viem 4001)
  if (
    e?.code === 4001 ||
    e?.shortMessage?.includes("User rejected") ||
    e?.message?.toLowerCase().includes("user rejected") ||
    e?.message?.toLowerCase().includes("user denied") ||
    e?.message?.toLowerCase().includes("transaction cancelled")
  ) {
    return "You cancelled the transaction.";
  }

  // Insufficient funds for gas
  if (
    e?.message?.toLowerCase().includes("insufficient funds") ||
    e?.shortMessage?.includes("insufficient funds") ||
    e?.message?.toLowerCase().includes("insufficient balance")
  ) {
    return "Not enough funds for gas fees.";
  }

  // Insufficient balance or allowance for ERC20
  if (e?.message?.toLowerCase().includes("insufficient")) {
    return "Insufficient balance or gas.";
  }

  // Contract revert / execution reverted
  if (
    e?.cause?.name === "ExecutionRevertedError" ||
    e?.message?.toLowerCase().includes("execution reverted") ||
    e?.shortMessage?.toLowerCase().includes("execution reverted")
  ) {
    return "Smart contract rejected transaction (check balance/stake).";
  }

  // Backend API errors
  if (e?.response?.status === 400) {
    const msg = (e.response?.data?.message ?? "").toLowerCase();
    if (msg.includes("already exists") || msg.includes("duplicate")) {
      return "Game code already taken. Try again in a moment.";
    }
    if (msg.includes("invalid stake") || msg.includes("minimum")) {
      return "Invalid stake amount.";
    }
    if (e.response?.data?.message) return e.response.data.message;
  }

  if (e?.response?.status === 429) {
    return "Too many requests — please wait a moment before trying again.";
  }

  // Prefer backend message so we don't show generic "API request failed" when we have context
  const backendMsg = e?.response?.data?.message ?? e?.response?.data?.error;
  if (backendMsg && typeof backendMsg === "string") {
    return backendMsg.slice(0, 140);
  }

  // Use explicit message if available (truncate long messages)
  const msg = e?.shortMessage ?? e?.message ?? "";
  if (msg && typeof msg === "string") {
    const trimmed = msg.slice(0, 140);
    // Don't surface generic API messages; use the caller's default (e.g. "Failed to vote")
    if (
      trimmed === "API request failed" ||
      trimmed === "No response from server"
    ) {
      return defaultMessage;
    }
    return trimmed;
  }

  return defaultMessage;
}
