import { describe, expect, it } from "vitest";
import {
  createReceiptVerifier,
  defineRule,
  InMemoryReplayStore,
  instapayEgyptPreset,
  ReceiptExtractionError,
  ReceiptVerifierError,
} from "../src/index.js";
import { extractorFor, transaction, validEvidence, validPng } from "./fixtures.js";

function verifierFor(evidence: unknown, subjectReplay = new InMemoryReplayStore()) {
  return createReceiptVerifier({
    extractor: extractorFor(evidence),
    preset: instapayEgyptPreset(),
    replayStore: subjectReplay,
  });
}

describe("receipt verifier", () => {
  it("passes an exact successful unique receipt and returns provenance", async () => {
    const result = await verifierFor(validEvidence).verify({
      image: { data: validPng, mediaType: "image/png" },
      transaction,
      reviewedAt: Date.UTC(2026, 7, 11, 7, 0),
    });
    expect(result.verdict).toBe("pass");
    expect(result.reasons).toEqual(["ok"]);
    expect(result.normalizedReference).toBe("663889003527");
    expect(result.image.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.provenance).toMatchObject({
      provider: "test",
      model: "fixture-model",
      requestId: "req_fixture",
      promptVersion: "instapay_egypt_v1",
    });
  });

  it("rejects definite amount, status, recipient, note, and suspicious mismatches", async () => {
    const result = await verifierFor({
      ...validEvidence,
      status: "Failed",
      amount: 999,
      recipientIdentifier: "000000",
      transferNote: "OTHER",
      suspicious: true,
    }).verify({
      image: { data: validPng, mediaType: "image/png" },
      transaction,
      reviewedAt: Date.UTC(2026, 7, 11, 7, 0),
    });
    expect(result.verdict).toBe("reject");
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        "transaction_not_successful",
        "amount_mismatch",
        "recipient_mismatch",
        "transfer_note_mismatch",
        "suspicious_evidence",
      ]),
    );
  });

  it("returns review for missing evidence rather than inventing facts", async () => {
    const result = await verifierFor({
      ...validEvidence,
      amount: null,
      transferAmountVisible: false,
      referenceId: null,
      transferredAtText: null,
      detailsExpanded: false,
      confidence: 0.4,
    }).verify({
      image: { data: validPng, mediaType: "image/png" },
      transaction,
    });
    expect(result.verdict).toBe("review");
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        "transfer_amount_missing",
        "transaction_time_missing",
        "reference_missing",
        "details_not_expanded",
        "low_confidence",
      ]),
    );
  });

  it("requires replay protection for a pass by default", async () => {
    const verifier = createReceiptVerifier({
      extractor: extractorFor(validEvidence),
      preset: instapayEgyptPreset(),
    });
    const result = await verifier.verify({
      image: { data: validPng, mediaType: "image/png" },
      transaction,
      reviewedAt: Date.UTC(2026, 7, 11, 7, 0),
    });
    expect(result.verdict).toBe("review");
    expect(result.reasons).toContain("replay_store_unavailable");
  });

  it("rejects cross-subject duplicate image and reference claims", async () => {
    const store = new InMemoryReplayStore();
    const verifier = verifierFor(validEvidence, store);
    await verifier.verify({
      image: { data: validPng, mediaType: "image/png" },
      transaction,
      reviewedAt: Date.UTC(2026, 7, 11, 7, 0),
    });
    const duplicate = await verifier.verify({
      image: { data: validPng, mediaType: "image/png" },
      transaction: { ...transaction, subjectId: "order_456" },
      reviewedAt: Date.UTC(2026, 7, 11, 7, 0),
    });
    expect(duplicate.verdict).toBe("reject");
    expect(duplicate.reasons).toEqual(
      expect.arrayContaining(["duplicate_image", "duplicate_reference"]),
    );
  });

  it("supports custom required and advisory rules", async () => {
    const preset = instapayEgyptPreset({
      customRules: [
        defineRule({
          id: "merchant_policy",
          evaluate() {
            return {
              id: "merchant_policy",
              status: "review",
              severity: "advisory",
              code: "merchant_manual_check",
              message: "Merchant chose to review this segment.",
            };
          },
        }),
      ],
    });
    const result = await createReceiptVerifier({
      extractor: extractorFor(validEvidence),
      preset,
      replayStore: new InMemoryReplayStore(),
    }).verify({
      image: { data: validPng, mediaType: "image/png" },
      transaction,
      reviewedAt: Date.UTC(2026, 7, 11, 7, 0),
    });
    expect(result.verdict).toBe("pass");
    expect(result.reasons).toContain("merchant_manual_check");
  });

  it("turns provider and schema failures into review results", async () => {
    const unavailable = createReceiptVerifier({
      extractor: {
        extract() {
          return Promise.reject(new ReceiptExtractionError("unavailable", "temporary outage"));
        },
      },
      preset: instapayEgyptPreset(),
    });
    const first = await unavailable.verify({
      image: { data: validPng, mediaType: "image/png" },
      transaction,
    });
    expect(first).toMatchObject({ verdict: "review", reasons: ["extraction_unavailable"] });

    const malformed = await verifierFor({ wrong: "shape" }).verify({
      image: { data: validPng, mediaType: "image/png" },
      transaction,
    });
    expect(malformed).toMatchObject({ verdict: "review", reasons: ["extraction_malformed"] });
  });

  it("rejects invalid images without calling the extractor", async () => {
    const result = await verifierFor(validEvidence).verify({
      image: { data: Buffer.from("not an image"), mediaType: "image/png" },
      transaction,
    });
    expect(result).toMatchObject({ verdict: "reject", reasons: ["image_format_unsupported"] });
  });

  it("throws only for invalid developer or transaction configuration", async () => {
    expect(() => instapayEgyptPreset({ policy: { confidence: { threshold: 2 } } })).toThrow(
      ReceiptVerifierError,
    );
    const verifier = verifierFor(validEvidence);
    await expect(
      verifier.verify({
        image: { data: validPng, mediaType: "image/png" },
        transaction: { ...transaction, subjectId: "" },
      }),
    ).rejects.toMatchObject({ code: "INVALID_TRANSACTION" });
  });
});
