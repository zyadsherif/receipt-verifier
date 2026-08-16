# API reference

## Entrypoints

- `instapay-receipt-verifier`: provider-neutral core, preset, types, normalizers, and replay port.
- `instapay-receipt-verifier/openai`: everything above plus the OpenAI adapter and one-call helper.

Both ESM `import` and CommonJS `require` are published with TypeScript declarations.

## `verifyInstapayReceipt(options)`

The shortest OpenAI integration. It creates an OpenAI extractor, the InstaPay Egypt preset, and a verifier for one call. `apiKey` defaults to `OPENAI_API_KEY`; `model` defaults to `RECOMMENDED_OPENAI_MODEL`.

## `createReceiptVerifier(options)`

Creates a reusable verifier from:

- `extractor`: a `ReceiptExtractor` implementation.
- `preset`: extraction schema, prompt, normalization, and rules.
- `replayStore`: optional port. A required replay policy returns `review` when absent.
- `imagePolicy`: optional maximum bytes, width, height, and pixels.

## Core input

`VerificationInput` contains image bytes, `mediaType`, the expected transaction, and an optional controlled `reviewedAt` clock. Transaction time values are epoch milliseconds. Amounts are base-unit decimal strings.

Recipient types are `phone`, `iban`, `account`, and `name`. Masked phone/account/IBAN evidence may match a sufficiently long visible suffix; names use normalized exact comparison.

## Core result

`VerificationResult` contains:

- `verdict`: `pass`, `review`, or `reject`.
- `reasons`: stable built-in or adopter-defined codes.
- `checks`: every rule's status, severity, code, and safe explanation.
- `evidence`: visible model-extracted facts after strict validation.
- `image`: SHA-256 and non-sensitive image metadata.
- `normalizedReference`: replay-safe canonical transaction reference.
- `provenance`: provider, model, request ID, prompt version, and latency.
- `warnings`: bounded model quality warnings.

Advisory rules are reported but do not lower the aggregate verdict. Required `reject` wins over `review`; otherwise any required review produces `review`.

## Errors

`ReceiptVerifierError` is reserved for developer misuse:

- `INVALID_CONFIGURATION`
- `INVALID_TRANSACTION`
- `INVALID_IMAGE` (normally converted into a reject result by the verifier)

`ReceiptExtractionError` is the provider-adapter boundary and distinguishes `unavailable` from `malformed`. The verifier converts both to review results.

Generate full declaration-derived HTML locally with `npm run docs`.
