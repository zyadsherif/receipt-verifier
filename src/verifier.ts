import { z } from "zod";
import { ReceiptExtractionError, ReceiptVerifierError } from "./errors.js";
import { validateImage } from "./image.js";
import type {
  CreateReceiptVerifierOptions,
  ReceiptEvidence,
  ReceiptVerifier,
  ReasonCode,
  RuleResult,
  VerificationInput,
  VerificationResult,
  VerificationVerdict,
} from "./types.js";

function validateTransaction(input: VerificationInput): void {
  const { transaction } = input;
  if (!transaction.subjectId.trim()) {
    throw new ReceiptVerifierError("INVALID_TRANSACTION", "transaction.subjectId is required.");
  }
  if (!transaction.amount.currency.trim() || !transaction.amount.value.trim()) {
    throw new ReceiptVerifierError("INVALID_TRANSACTION", "transaction.amount is required.");
  }
  if (!transaction.recipient.value.trim()) {
    throw new ReceiptVerifierError("INVALID_TRANSACTION", "transaction.recipient is required.");
  }
  if (
    !Number.isFinite(transaction.validFrom) ||
    !Number.isFinite(transaction.validUntil) ||
    transaction.validUntil < transaction.validFrom
  ) {
    throw new ReceiptVerifierError("INVALID_TRANSACTION", "Transaction time window is invalid.");
  }
}

function aggregate(checks: readonly RuleResult[]): VerificationVerdict {
  const required = checks.filter((check) => check.severity === "required");
  if (required.some((check) => check.status === "reject")) return "reject";
  if (required.some((check) => check.status === "review")) return "review";
  return "pass";
}

function reasonList(checks: readonly RuleResult[]): ReasonCode[] {
  const reasons = checks.filter((check) => check.status !== "pass").map((check) => check.code);
  return reasons.length > 0 ? [...new Set(reasons)] : ["ok"];
}

function imageFailureResult<Evidence extends ReceiptEvidence>(
  input: VerificationInput,
  error: ReceiptVerifierError,
): VerificationResult<Evidence> {
  const message = error.message.toLowerCase();
  const code: ReasonCode = message.includes("byte limit")
    ? "image_too_large"
    : message.includes("dimensions exceed")
      ? "image_dimensions_too_large"
      : message.includes("media type")
        ? "image_format_unsupported"
        : "image_invalid";
  const check: RuleResult = {
    id: "image",
    status: "reject",
    severity: "required",
    code,
    message: error.message,
  };
  const bytes =
    input.image.data instanceof Blob
      ? input.image.data.size
      : input.image.data instanceof ArrayBuffer
        ? input.image.data.byteLength
        : input.image.data.byteLength;
  return {
    verdict: "reject",
    reasons: [code],
    checks: [check],
    image: { mediaType: input.image.mediaType, bytes },
    warnings: [],
  };
}

export function createReceiptVerifier<Evidence extends ReceiptEvidence>(
  options: CreateReceiptVerifierOptions<Evidence>,
): ReceiptVerifier<Evidence> {
  if (!options.extractor || !options.preset) {
    throw new ReceiptVerifierError("INVALID_CONFIGURATION", "extractor and preset are required.");
  }

  return {
    async verify(input): Promise<VerificationResult<Evidence>> {
      validateTransaction(input);
      let image;
      try {
        image = await validateImage(input.image, options.imagePolicy);
      } catch (error) {
        if (error instanceof ReceiptVerifierError) return imageFailureResult(input, error);
        throw error;
      }

      const startedAt = Date.now();
      let extracted;
      try {
        extracted = await options.extractor.extract({
          imageBytes: image.bytes,
          mediaType: image.mediaType,
          prompt: options.preset.prompt,
          promptVersion: options.preset.promptVersion,
          schemaName: options.preset.schemaName,
          jsonSchema: options.preset.jsonSchema,
        });
      } catch (error) {
        const malformed =
          error instanceof ReceiptExtractionError
            ? error.kind === "malformed"
            : error instanceof z.ZodError;
        const code: ReasonCode = malformed ? "extraction_malformed" : "extraction_unavailable";
        const check: RuleResult = {
          id: "extraction",
          status: "review",
          severity: "required",
          code,
          message: malformed
            ? "The model response did not match the receipt schema."
            : "Receipt extraction is temporarily unavailable.",
        };
        return {
          verdict: "review",
          reasons: [code],
          checks: [check],
          image: {
            sha256: image.sha256,
            mediaType: image.mediaType,
            bytes: image.bytes.length,
            width: image.width,
            height: image.height,
          },
          warnings: [],
        };
      }

      let evidence: Evidence;
      try {
        evidence = options.preset.parseEvidence(extracted.evidence);
      } catch {
        const check: RuleResult = {
          id: "extraction",
          status: "review",
          severity: "required",
          code: "extraction_malformed",
          message: "The model response did not match the receipt schema.",
        };
        return {
          verdict: "review",
          reasons: ["extraction_malformed"],
          checks: [check],
          image: {
            sha256: image.sha256,
            mediaType: image.mediaType,
            bytes: image.bytes.length,
            width: image.width,
            height: image.height,
          },
          provenance: {
            ...extracted.provenance,
            promptVersion: options.preset.promptVersion,
            latencyMs: Date.now() - startedAt,
          },
          warnings: [],
        };
      }

      const reviewedAt = input.reviewedAt ?? Date.now();
      const normalizedReference = options.preset.normalizeReference(evidence.referenceId);
      const context = {
        evidence,
        transaction: input.transaction,
        imageSha256: image.sha256,
        ...(normalizedReference ? { normalizedReference } : {}),
        reviewedAt,
      };
      const checks: RuleResult[] = [];
      for (const rule of options.preset.rules) {
        const evaluated = await rule.evaluate(context);
        checks.push({ ...evaluated, severity: evaluated.severity ?? rule.severity ?? "required" });
      }

      if (options.preset.replayProtection !== "off") {
        const severity = options.preset.replayProtection === "required" ? "required" : "advisory";
        if (!options.replayStore) {
          checks.push({
            id: "replay",
            status: "review",
            severity,
            code: "replay_store_unavailable",
            message: "Replay protection requires a durable atomic ReplayStore.",
          });
        } else {
          try {
            const claim = await options.replayStore.claim({
              scope: input.transaction.replayScope?.trim() || options.preset.id,
              subjectId: input.transaction.subjectId,
              imageSha256: image.sha256,
              ...(normalizedReference ? { normalizedReference } : {}),
            });
            if (claim.image === "duplicate") {
              checks.push({
                id: "replay_image",
                status: "reject",
                severity,
                code: "duplicate_image",
                message: "This image belongs to another subject.",
              });
            } else {
              checks.push({
                id: "replay_image",
                status: "pass",
                severity,
                code: "ok",
                message: "Image replay claim is unique or idempotent.",
              });
            }
            if (normalizedReference) {
              if (claim.reference === "duplicate") {
                checks.push({
                  id: "replay_reference",
                  status: "reject",
                  severity,
                  code: "duplicate_reference",
                  message: "This transaction reference belongs to another subject.",
                });
              } else {
                checks.push({
                  id: "replay_reference",
                  status: "pass",
                  severity,
                  code: "ok",
                  message: "Reference replay claim is unique or idempotent.",
                });
              }
            }
          } catch {
            checks.push({
              id: "replay",
              status: "review",
              severity,
              code: "replay_store_unavailable",
              message: "Replay protection could not be completed.",
            });
          }
        }
      }

      return {
        verdict: aggregate(checks),
        reasons: reasonList(checks),
        checks,
        evidence,
        image: {
          sha256: image.sha256,
          mediaType: image.mediaType,
          bytes: image.bytes.length,
          width: image.width,
          height: image.height,
        },
        ...(normalizedReference ? { normalizedReference } : {}),
        provenance: {
          ...extracted.provenance,
          promptVersion: options.preset.promptVersion,
          latencyMs: Date.now() - startedAt,
        },
        warnings: evidence.qualityWarnings,
      };
    },
  };
}
