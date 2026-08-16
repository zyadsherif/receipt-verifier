export type ReceiptVerifierErrorCode =
  "INVALID_CONFIGURATION" | "INVALID_TRANSACTION" | "INVALID_IMAGE";

export class ReceiptVerifierError extends Error {
  readonly code: ReceiptVerifierErrorCode;

  constructor(code: ReceiptVerifierErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ReceiptVerifierError";
    this.code = code;
  }
}

export class ReceiptExtractionError extends Error {
  readonly kind: "unavailable" | "malformed";

  constructor(kind: "unavailable" | "malformed", message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ReceiptExtractionError";
    this.kind = kind;
  }
}
