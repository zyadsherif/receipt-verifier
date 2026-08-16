# instapay-receipt-verifier

[![CI](https://github.com/zyadsherif/receipt-verifier/actions/workflows/ci.yml/badge.svg)](https://github.com/zyadsherif/receipt-verifier/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/instapay-receipt-verifier.svg)](https://www.npmjs.com/package/instapay-receipt-verifier)
[![license](https://img.shields.io/npm/l/instapay-receipt-verifier.svg)](./LICENSE)

Backend-first AI receipt verification with a hardened Egyptian InstaPay preset. Send image bytes and the transaction you expected; receive visible evidence, deterministic checks, and a conservative `pass`, `review`, or `reject` recommendation.

> [!IMPORTANT]
> This library checks whether a screenshot is visually consistent with expected transaction details. It cannot query the banking network and does **not** prove settlement. Keep human review and bank reconciliation appropriate to your risk.

## Why this package

- One function for the common OpenAI + InstaPay path.
- Deterministic money, currency, recipient, note, timestamp, reference, and replay checks.
- Arabic and English receipts, including Arabic and Persian numerals.
- Provider-neutral core: replace OpenAI, storage, rules, or the InstaPay preset.
- Fail-closed behavior: outages and uncertainty return `review`, never an invented pass.
- No framework, database, frontend, or payment-lifecycle dependency.

## Install

```bash
npm install instapay-receipt-verifier
```

Requires Node.js 20 or newer. Keep this package on your backend—never expose an AI provider key to a browser or mobile app.

## Five-minute quickstart

```ts
import { readFile } from "node:fs/promises";
import { InMemoryReplayStore, verifyInstapayReceipt } from "instapay-receipt-verifier/openai";

const result = await verifyInstapayReceipt({
  // Optional when OPENAI_API_KEY is set.
  apiKey: process.env.OPENAI_API_KEY,
  image: {
    data: await readFile("receipt.png"),
    mediaType: "image/png",
  },
  transaction: {
    subjectId: "order_123",
    replayScope: "merchant_456",
    amount: { value: "1000.00", currency: "EGP" },
    recipient: { type: "iban", value: "EG..." },
    transferNote: "ORDER-123",
    validFrom: Date.now() - 15 * 60_000,
    validUntil: Date.now() + 15 * 60_000,
  },
  // Development only. Implement ReplayStore with your database in production.
  replayStore: new InMemoryReplayStore(),
});

switch (result.verdict) {
  case "pass":
    // Continue your host application's payment workflow.
    break;
  case "reject":
    // Show a safe reason and allow a new proof where appropriate.
    break;
  case "review":
    // Queue evidence for a human; do not create value automatically.
    break;
}
```

The package accepts `Buffer`, `Uint8Array`, `ArrayBuffer`, or `Blob`. Fetch URLs yourself from trusted storage so your application controls authentication and avoids server-side request forgery.

## What comes back

```ts
{
  verdict: "pass",
  reasons: ["ok"],
  checks: [
    { id: "amount", status: "pass", severity: "required", code: "ok", ... },
    { id: "recipient", status: "pass", severity: "required", code: "ok", ... }
  ],
  evidence: {
    provider: "InstaPay IPN",
    status: "Approved Transaction",
    amount: 1000,
    feeAmount: 1,
    totalDebitedAmount: 1001,
    referenceId: "663889003527",
    confidence: 0.99,
    suspicious: false,
    ...
  },
  image: { sha256: "...", mediaType: "image/png", bytes: 482113, width: 1170, height: 2532 },
  normalizedReference: "663889003527",
  provenance: { provider: "openai", model: "gpt-5.6-terra", promptVersion: "instapay_egypt_v1", ... },
  warnings: []
}
```

Only invalid developer configuration throws. Invalid proof images return `reject`; provider outages, malformed model output, missing facts, low confidence, and required replay-store outages return `review`.

## Configuration cookbook

### Amount tolerance

Money is configured as decimal strings and compared as integers internally.

```ts
preset: {
  policy: {
    amount: { tolerance: "0.01", currencyScale: 2 },
  },
}
```

### Transfer notes

Supplying `transaction.transferNote` compares the visible Note/Memo after Unicode, numeral, case, and whitespace normalization. To require a note on every call:

```ts
preset: {
  policy: {
    transferNote: {
      required: true;
    }
  }
}
```

### Trusted extraction guidance

Guidance helps the model read a known layout; it does not replace deterministic rules.

```ts
preset: {
  extractionGuidance: [
    "The merchant's Android screenshots use an Arabic-language layout.",
    "The expected recipient is shown as a masked bank account, not a phone.",
  ],
}
```

### Custom rules

```ts
import { defineRule, instapayEgyptPreset } from "instapay-receipt-verifier";

const preset = instapayEgyptPreset({
  customRules: [
    defineRule({
      id: "merchant_reference_prefix",
      evaluate({ normalizedReference }) {
        const matches = normalizedReference?.startsWith("66") === true;
        return {
          id: "merchant_reference_prefix",
          status: matches ? "pass" : "review",
          severity: "required",
          code: matches ? "ok" : "merchant_reference_unexpected",
          message: matches ? "Reference prefix matches." : "Review the reference manually.",
        };
      },
    }),
  ],
});
```

### Custom AI provider

Implement the small `ReceiptExtractor` port and pass it to `createReceiptVerifier`. The core never imports OpenAI.

```ts
const verifier = createReceiptVerifier({
  extractor: myVisionExtractor,
  preset: instapayEgyptPreset(),
  replayStore: myReplayStore,
});
```

## Models

- `gpt-5.6-terra` is the default balance of accuracy and cost.
- `gpt-5.6-luna` is the economy candidate; evaluate it on your receipts before production.
- `gpt-5.6-sol` is the accuracy benchmark for difficult layouts.

Pin and evaluate the model appropriate to your workload. Every result records model and prompt provenance. See the [official OpenAI model documentation](https://developers.openai.com/api/docs/models) and [evaluation guide](./docs/EVALUATION.md).

## Production checklist

- Use a durable database-backed `ReplayStore` with one atomic claim operation.
- Scope replay identities per merchant or trust boundary.
- Keep `subjectId` stable across retries.
- Store the returned decision and provenance, not raw provider secrets.
- Do not log receipt bytes or unmasked account data.
- Send `review` to a human queue and reconcile meaningful payments against bank evidence.
- Test model/prompt upgrades on representative redacted or synthetic fixtures.
- Set API budgets, timeouts, and monitoring.

## Documentation

- [API reference](./docs/API.md)
- [InstaPay preset](./docs/INSTAPAY_PRESET.md)
- [Custom providers, rules, and replay stores](./docs/CUSTOMIZATION.md)
- [Security, privacy, and threat model](./docs/SECURITY_AND_PRIVACY.md)
- [Evaluation and model upgrades](./docs/EVALUATION.md)
- [Release process](./docs/RELEASING.md)
- [Node example](./examples/node/README.md)

## Troubleshooting

- `Provide apiKey or set OPENAI_API_KEY`: configure the key on the server or inject an OpenAI client.
- `review` + `replay_store_unavailable`: pass a durable `ReplayStore`; the InstaPay preset requires replay protection by default.
- `reject` + `image_format_unsupported`: the declared media type does not match the bytes, or the file is not JPEG/PNG/WebP.
- `review` + `extraction_malformed`: retain the proof for human review and evaluate the configured model against that layout.
- Correct total but `amount_mismatch`: the package intentionally compares Transfer Amount/Amount Sent, never a fee-inclusive total debit.

## License and trademarks

MIT © Zyad Sherif. This independent open-source project is not affiliated with, endorsed by, or sponsored by InstaPay, the Instant Payment Network, the Central Bank of Egypt, or OpenAI. Product names and trademarks belong to their respective owners.
