/** User-visible copy when the wallet declines signing (close modal, reject, etc.). */
export const NEAR_SIGNATURE_REJECTED_MESSAGE =
  "Transaction was not signed. Connect your wallet and approve the request to continue.";

export function isLikelyUserRejectedError(error: unknown): boolean {
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const lower = msg.toLowerCase();
  return (
    /user rejected|rejected|denied|cancel|closed|user closed|dismiss/i.test(
      lower,
    ) || lower.includes("user cancelled")
  );
}

export function nearErrorMessage(error: unknown): string {
  if (isLikelyUserRejectedError(error)) {
    return NEAR_SIGNATURE_REJECTED_MESSAGE;
  }
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong with the NEAR wallet request.";
}
