/** User-visible copy when the wallet declines signing (close modal, reject, etc.). */
export const NEAR_SIGNATURE_REJECTED_MESSAGE =
  "Transaction was not signed. Connect your wallet and approve the request to continue.";

function extractErrorText(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message || "";

  if (error && typeof error === "object") {
    const candidate = (error as { message?: unknown }).message;
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
    if (candidate !== undefined) {
      const nested = extractErrorText(candidate);
      if (nested) return nested;
    }

    const nestedError = (error as { error?: unknown }).error;
    if (typeof nestedError === "string" && nestedError.length > 0) {
      return nestedError;
    }
    if (nestedError !== undefined) {
      const nested = extractErrorText(nestedError);
      if (nested) return nested;
    }

    const cause = (error as { cause?: unknown }).cause;
    if (typeof cause === "string" && cause.length > 0) {
      return cause;
    }
    if (cause !== undefined) {
      const nested = extractErrorText(cause);
      if (nested) return nested;
    }

    const text = String(error);
    if (text && text !== "[object Object]") return text;
  }

  return "";
}

export function isLikelyUserRejectedError(error: unknown): boolean {
  const msg = extractErrorText(error).toLowerCase();
  return (
    /user rejected|rejected|denied|cancel|closed|user closed|dismiss|user cancelled/.test(
      msg,
    )
  );
}

export function nearErrorMessage(error: unknown): string {
  if (isLikelyUserRejectedError(error)) {
    return NEAR_SIGNATURE_REJECTED_MESSAGE;
  }

  const rawMessage = extractErrorText(error).trim();
  if (!rawMessage) {
    return "Something went wrong with the NEAR wallet request.";
  }

  const normalized = rawMessage.toLowerCase();
  if (
    normalized.includes("wallet not connected") ||
    normalized.includes("not connected") ||
    normalized.includes("connect your wallet") ||
    normalized.includes("not signed in") ||
    normalized.includes("no wallet") ||
    normalized.includes("no selector")
  ) {
    return "Connect your NEAR wallet to continue.";
  }

  if (
    normalized.includes("account does not exist") ||
    normalized.includes("does not exist")
  ) {
    return "The connected NEAR account does not exist.";
  }

  if (
    normalized.includes("invalid account") ||
    normalized.includes("invalid receiver") ||
    normalized.includes("invalid contract")
  ) {
    return "The NEAR account or contract ID is invalid.";
  }

  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("network request failed") ||
    normalized.includes("timeout") ||
    normalized.includes("econnrefused") ||
    normalized.includes("dns")
  ) {
    return "Unable to reach the NEAR network. Check your internet connection.";
  }

  if (
    normalized.includes("wallet selector is not ready") ||
    normalized.includes("wallet is not ready") ||
    normalized.includes("not ready yet")
  ) {
    return "The NEAR wallet is not ready yet. Try reconnecting.";
  }

  return rawMessage;
}
