import { readFile } from "node:fs/promises";
import { InMemoryReplayStore, verifyInstapayReceipt } from "../../dist/openai-entry.js";

const [path, mediaType = "image/png"] = process.argv.slice(2);
if (!path) throw new Error("Usage: node verify-receipt.mjs <receipt-path> [image-media-type]");

const now = Date.now();
const result = await verifyInstapayReceipt({
  image: { data: await readFile(path), mediaType },
  transaction: {
    subjectId: process.env.ORDER_ID ?? "example-order",
    replayScope: process.env.MERCHANT_ID ?? "example-merchant",
    amount: { value: process.env.EXPECTED_AMOUNT ?? "1000.00", currency: "EGP" },
    recipient: {
      type: process.env.RECIPIENT_TYPE ?? "account",
      value: process.env.EXPECTED_RECIPIENT ?? "1234567890",
    },
    ...(process.env.EXPECTED_NOTE ? { transferNote: process.env.EXPECTED_NOTE } : {}),
    validFrom: now - 30 * 60_000,
    validUntil: now + 5 * 60_000,
  },
  // Replace with a durable atomic ReplayStore in production.
  replayStore: new InMemoryReplayStore(),
});

const applicationDecision = {
  pass: { status: 200, action: "continue_payment_workflow" },
  review: { status: 202, action: "queue_human_review" },
  reject: { status: 422, action: "request_new_proof" },
}[result.verdict];

process.stdout.write(`${JSON.stringify({ ...applicationDecision, result }, null, 2)}\n`);
