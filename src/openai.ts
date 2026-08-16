import OpenAI from "openai";
import { ReceiptExtractionError, ReceiptVerifierError } from "./errors.js";
import { instapayEgyptPreset, type InstaPayEgyptPresetOptions } from "./presets/instapay-egypt.js";
import type {
  ImagePolicy,
  ReceiptExtractor,
  ReplayStore,
  VerificationInput,
  VerificationResult,
} from "./types.js";
import { createReceiptVerifier } from "./verifier.js";

export const RECOMMENDED_OPENAI_MODEL = "gpt-5.6-terra";
export const ACCURACY_OPENAI_MODEL = "gpt-5.6-sol";
export const ECONOMY_OPENAI_MODEL = "gpt-5.6-luna";

export interface OpenAIExtractorOptions {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  maxRetries?: number;
  client?: OpenAI;
}

export function openAIExtractor(options: OpenAIExtractorOptions = {}): ReceiptExtractor {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!options.client && !apiKey) {
    throw new ReceiptVerifierError(
      "INVALID_CONFIGURATION",
      "Provide apiKey or set OPENAI_API_KEY.",
    );
  }
  const model = options.model ?? RECOMMENDED_OPENAI_MODEL;
  const client =
    options.client ??
    new OpenAI({
      apiKey,
      timeout: options.timeoutMs ?? 30_000,
      maxRetries: options.maxRetries ?? 2,
    });

  return {
    async extract(request) {
      const dataUrl = `data:${request.mediaType};base64,${Buffer.from(request.imageBytes).toString("base64")}`;
      try {
        const response = await client.responses.create({
          model,
          store: false,
          input: [
            {
              role: "developer",
              content: [{ type: "input_text", text: request.prompt }],
            },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: "Extract the visible receipt evidence into the required schema.",
                },
                { type: "input_image", image_url: dataUrl, detail: "high" },
              ],
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: request.schemaName,
              strict: true,
              schema: request.jsonSchema,
            },
          },
        });
        if (!response.output_text) {
          throw new ReceiptExtractionError("malformed", "OpenAI returned no structured output.");
        }
        let evidence: unknown;
        try {
          evidence = JSON.parse(response.output_text) as unknown;
        } catch (error) {
          throw new ReceiptExtractionError("malformed", "OpenAI returned invalid JSON.", {
            cause: error,
          });
        }
        return {
          evidence,
          provenance: {
            provider: "openai",
            model,
            ...((response as { _request_id?: string })._request_id
              ? { requestId: (response as { _request_id: string })._request_id }
              : {}),
          },
        };
      } catch (error) {
        if (error instanceof ReceiptExtractionError) throw error;
        throw new ReceiptExtractionError("unavailable", "OpenAI receipt extraction failed.", {
          cause: error,
        });
      }
    },
  };
}

export interface VerifyInstapayReceiptOptions extends VerificationInput {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  maxRetries?: number;
  replayStore?: ReplayStore;
  preset?: InstaPayEgyptPresetOptions;
  imagePolicy?: ImagePolicy;
  /** Primarily intended for tests and advanced dependency injection. */
  client?: OpenAI;
}

export async function verifyInstapayReceipt(
  options: VerifyInstapayReceiptOptions,
): Promise<VerificationResult> {
  const verifier = createReceiptVerifier({
    extractor: openAIExtractor({
      ...(options.apiKey ? { apiKey: options.apiKey } : {}),
      ...(options.model ? { model: options.model } : {}),
      ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
      ...(options.maxRetries !== undefined ? { maxRetries: options.maxRetries } : {}),
      ...(options.client ? { client: options.client } : {}),
    }),
    preset: instapayEgyptPreset(options.preset),
    ...(options.replayStore ? { replayStore: options.replayStore } : {}),
    ...(options.imagePolicy ? { imagePolicy: options.imagePolicy } : {}),
  });
  return verifier.verify({
    image: options.image,
    transaction: options.transaction,
    ...(options.reviewedAt !== undefined ? { reviewedAt: options.reviewedAt } : {}),
  });
}
