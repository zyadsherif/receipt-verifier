import type OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import { openAIExtractor, RECOMMENDED_OPENAI_MODEL } from "../src/openai-entry.js";
import { instapayEgyptPreset } from "../src/index.js";
import { validEvidence, validPng } from "./fixtures.js";

describe("OpenAI extractor", () => {
  it("uses strict structured output, high image detail, and store false", async () => {
    const create = vi.fn<(input: unknown) => Promise<unknown>>().mockResolvedValue({
      output_text: JSON.stringify({
        ...validEvidence,
        provider: validEvidence.provider ?? null,
        status: validEvidence.status ?? null,
        amount: validEvidence.amount ?? null,
        feeAmount: validEvidence.feeAmount ?? null,
        totalDebitedAmount: validEvidence.totalDebitedAmount ?? null,
        currency: validEvidence.currency ?? null,
        recipientName: validEvidence.recipientName ?? null,
        recipientIdentifier: validEvidence.recipientIdentifier ?? null,
        transferNote: validEvidence.transferNote ?? null,
        senderAlias: validEvidence.senderAlias ?? null,
        senderMaskedAccount: validEvidence.senderMaskedAccount ?? null,
        transferredAtText: validEvidence.transferredAtText ?? null,
        referenceId: validEvidence.referenceId ?? null,
        language: validEvidence.language ?? null,
      }),
      _request_id: "req_openai",
    });
    const client = { responses: { create } } as unknown as OpenAI;
    const preset = instapayEgyptPreset();
    const response = await openAIExtractor({ client }).extract({
      imageBytes: validPng,
      mediaType: "image/png",
      prompt: preset.prompt,
      promptVersion: preset.promptVersion,
      schemaName: preset.schemaName,
      jsonSchema: preset.jsonSchema,
    });
    expect(response.provenance).toEqual({
      provider: "openai",
      model: RECOMMENDED_OPENAI_MODEL,
      requestId: "req_openai",
    });
    const request = create.mock.calls[0]?.[0] as {
      model: string;
      store: boolean;
      text: { format: { type: string; strict: boolean } };
      input: Array<{ content: Array<{ type: string; detail?: string }> }>;
    };
    expect(request.model).toBe(RECOMMENDED_OPENAI_MODEL);
    expect(request.store).toBe(false);
    expect(request.text.format).toMatchObject({ type: "json_schema", strict: true });
    expect(request.input[1]?.content[1]).toMatchObject({ type: "input_image", detail: "high" });
  });

  it("requires a key or injected client", () => {
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      expect(() => openAIExtractor()).toThrow(/OPENAI_API_KEY/);
    } finally {
      if (previous) process.env.OPENAI_API_KEY = previous;
    }
  });
});
