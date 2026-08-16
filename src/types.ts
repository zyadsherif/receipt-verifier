export type VerificationVerdict = "pass" | "review" | "reject";
export type RuleSeverity = "required" | "advisory";
export type RuleStatus = "pass" | "review" | "reject";

export type BuiltInReasonCode =
  | "ok"
  | "image_invalid"
  | "image_too_large"
  | "image_dimensions_too_large"
  | "image_format_unsupported"
  | "extraction_unavailable"
  | "extraction_malformed"
  | "provider_missing"
  | "provider_mismatch"
  | "transaction_status_missing"
  | "transaction_not_successful"
  | "transfer_amount_missing"
  | "amount_mismatch"
  | "currency_missing"
  | "currency_mismatch"
  | "recipient_missing"
  | "recipient_mismatch"
  | "transfer_note_missing"
  | "transfer_note_mismatch"
  | "transaction_time_missing"
  | "transaction_time_invalid"
  | "reference_missing"
  | "details_not_expanded"
  | "low_confidence"
  | "suspicious_evidence"
  | "duplicate_image"
  | "duplicate_reference"
  | "replay_store_unavailable";

export type ReasonCode = BuiltInReasonCode | (string & {});

export type SupportedImageMediaType = "image/jpeg" | "image/png" | "image/webp";

export interface ReceiptImage {
  data: Buffer | Uint8Array | ArrayBuffer | Blob;
  mediaType: SupportedImageMediaType;
}

export interface MoneyExpectation {
  /** A base-unit decimal string, for example `"1000.00"`. */
  value: string;
  currency: string;
}

export type RecipientExpectation =
  | { type: "phone"; value: string }
  | { type: "iban"; value: string }
  | { type: "account"; value: string }
  | { type: "name"; value: string };

export interface TransactionExpectation {
  /** Stable host identifier used to make replay claims idempotent. */
  subjectId: string;
  /** Optional tenant/merchant boundary for replay checks. */
  replayScope?: string;
  amount: MoneyExpectation;
  recipient: RecipientExpectation;
  transferNote?: string;
  /** Inclusive epoch-millisecond lower bound for the transfer. */
  validFrom: number;
  /** Inclusive epoch-millisecond upper bound for the transfer. */
  validUntil: number;
}

export interface ReceiptEvidence {
  provider?: string;
  status?: string;
  amount?: number;
  feeAmount?: number;
  totalDebitedAmount?: number;
  transferAmountVisible: boolean;
  currency?: string;
  recipientName?: string;
  recipientIdentifier?: string;
  transferNote?: string;
  senderAlias?: string;
  senderMaskedAccount?: string;
  transferredAtText?: string;
  referenceId?: string;
  detailsExpanded: boolean;
  language?: "en" | "ar";
  confidence: number;
  suspicious: boolean;
  qualityWarnings: string[];
}

export interface ModelProvenance {
  provider: string;
  model: string;
  requestId?: string;
  promptVersion: string;
  latencyMs: number;
}

export interface ExtractionRequest {
  imageBytes: Uint8Array;
  mediaType: SupportedImageMediaType;
  prompt: string;
  promptVersion: string;
  schemaName: string;
  jsonSchema: Readonly<Record<string, unknown>>;
}

export interface ExtractionResponse {
  evidence: unknown;
  provenance: Omit<ModelProvenance, "promptVersion" | "latencyMs">;
}

export interface ReceiptExtractor {
  extract(request: ExtractionRequest): Promise<ExtractionResponse>;
}

export interface RuleResult {
  id: string;
  status: RuleStatus;
  severity: RuleSeverity;
  code: ReasonCode;
  message: string;
  expected?: string | number | boolean;
  actual?: string | number | boolean;
}

export interface RuleContext<Evidence extends ReceiptEvidence = ReceiptEvidence> {
  evidence: Evidence;
  transaction: TransactionExpectation;
  imageSha256: string;
  normalizedReference?: string;
  reviewedAt: number;
}

export interface VerificationRule<Evidence extends ReceiptEvidence = ReceiptEvidence> {
  id: string;
  severity?: RuleSeverity;
  evaluate(context: RuleContext<Evidence>): RuleResult | Promise<RuleResult>;
}

export interface ReceiptPreset<Evidence extends ReceiptEvidence = ReceiptEvidence> {
  id: string;
  promptVersion: string;
  prompt: string;
  schemaName: string;
  jsonSchema: Readonly<Record<string, unknown>>;
  replayProtection: "required" | "optional" | "off";
  parseEvidence(input: unknown): Evidence;
  normalizeReference(value?: string): string | undefined;
  rules: readonly VerificationRule<Evidence>[];
}

export interface ReplayClaimRequest {
  scope: string;
  subjectId: string;
  imageSha256: string;
  normalizedReference?: string;
}

export type ReplayClaimState = "claimed" | "owned" | "duplicate";

export interface ReplayClaimResult {
  image: ReplayClaimState;
  reference?: ReplayClaimState;
}

export interface ReplayStore {
  /** Atomically checks and claims both identities. */
  claim(request: ReplayClaimRequest): Promise<ReplayClaimResult>;
}

export interface ImagePolicy {
  maxBytes?: number;
  maxWidth?: number;
  maxHeight?: number;
  maxPixels?: number;
}

export interface VerificationInput {
  image: ReceiptImage;
  transaction: TransactionExpectation;
  /** Overrides the clock in tests or controlled backfills. */
  reviewedAt?: number;
}

export interface VerificationResult<Evidence extends ReceiptEvidence = ReceiptEvidence> {
  verdict: VerificationVerdict;
  reasons: ReasonCode[];
  checks: RuleResult[];
  evidence?: Evidence;
  image: {
    sha256?: string;
    mediaType: SupportedImageMediaType;
    bytes: number;
    width?: number;
    height?: number;
  };
  normalizedReference?: string;
  provenance?: ModelProvenance;
  warnings: string[];
}

export interface ReceiptVerifier<Evidence extends ReceiptEvidence = ReceiptEvidence> {
  verify(input: VerificationInput): Promise<VerificationResult<Evidence>>;
}

export interface CreateReceiptVerifierOptions<Evidence extends ReceiptEvidence = ReceiptEvidence> {
  extractor: ReceiptExtractor;
  preset: ReceiptPreset<Evidence>;
  replayStore?: ReplayStore;
  imagePolicy?: ImagePolicy;
}
