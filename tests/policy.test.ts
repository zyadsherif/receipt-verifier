import { describe, expect, it } from "vitest";
import {
  createReceiptVerifier,
  InMemoryReplayStore,
  instapayEgyptPreset,
  ReceiptExtractionError,
} from "../src/index.js";
import { extractorFor, transaction, validEvidence, validPng } from "./fixtures.js";

const reviewedAt = Date.UTC(2026, 7, 11, 7, 0);

async function evaluate(evidence: unknown) {
  return createReceiptVerifier({
    extractor: extractorFor(evidence),
    preset: instapayEgyptPreset(),
    replayStore: new InMemoryReplayStore(),
  }).verify({ image: { data: validPng, mediaType: "image/png" }, transaction, reviewedAt });
}

describe("InstaPay policy edges", () => {
  it("distinguishes missing facts from definite mismatches", async () => {
    const missing = await evaluate({
      ...validEvidence,
      provider: null,
      status: null,
      currency: null,
      recipientIdentifier: null,
      transferNote: null,
    });
    expect(missing.verdict).toBe("review");
    expect(missing.reasons).toEqual(
      expect.arrayContaining([
        "provider_missing",
        "transaction_status_missing",
        "currency_missing",
        "recipient_missing",
        "transfer_note_missing",
      ]),
    );

    const mismatch = await evaluate({
      ...validEvidence,
      provider: "Another Wallet",
      currency: "USD",
      recipientIdentifier: "987654321",
      transferredAtText: "11 Aug 2026 11:32 AM",
    });
    expect(mismatch.verdict).toBe("reject");
    expect(mismatch.reasons).toEqual(
      expect.arrayContaining([
        "provider_mismatch",
        "currency_mismatch",
        "recipient_mismatch",
        "transaction_time_invalid",
      ]),
    );
  });

  it("supports amount tolerance and optional replay protection", async () => {
    const preset = instapayEgyptPreset({
      replayProtection: "optional",
      policy: { amount: { tolerance: "0.05" } },
    });
    const result = await createReceiptVerifier({
      extractor: extractorFor({ ...validEvidence, amount: 1000.04 }),
      preset,
    }).verify({ image: { data: validPng, mediaType: "image/png" }, transaction, reviewedAt });
    expect(result.verdict).toBe("pass");
    expect(result.reasons).toContain("replay_store_unavailable");
  });

  it("validates note policy, amount policy, and unique custom rule IDs", () => {
    expect(() => instapayEgyptPreset({ policy: { amount: { tolerance: "invalid" } } })).toThrow(
      /tolerance/,
    );
    expect(() => instapayEgyptPreset({ policy: { amount: { currencyScale: 7 } } })).toThrow(
      /currencyScale/,
    );
    expect(() =>
      instapayEgyptPreset({
        customRules: [
          {
            id: "provider",
            evaluate: () => ({
              id: "provider",
              status: "pass",
              severity: "required",
              code: "ok",
              message: "duplicate",
            }),
          },
        ],
      }),
    ).toThrow(/unique/);
  });

  it("returns review when replay storage throws", async () => {
    const result = await createReceiptVerifier({
      extractor: extractorFor(validEvidence),
      preset: instapayEgyptPreset(),
      replayStore: {
        claim() {
          return Promise.reject(new Error("database unavailable"));
        },
      },
    }).verify({ image: { data: validPng, mediaType: "image/png" }, transaction, reviewedAt });
    expect(result).toMatchObject({ verdict: "review" });
    expect(result.reasons).toContain("replay_store_unavailable");
  });

  it("preserves malformed extraction classification", async () => {
    const verifier = createReceiptVerifier({
      extractor: {
        extract() {
          return Promise.reject(new ReceiptExtractionError("malformed", "bad json"));
        },
      },
      preset: instapayEgyptPreset(),
    });
    await expect(
      verifier.verify({ image: { data: validPng, mediaType: "image/png" }, transaction }),
    ).resolves.toMatchObject({ verdict: "review", reasons: ["extraction_malformed"] });
  });
});
