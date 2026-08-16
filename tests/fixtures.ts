import type { ReceiptEvidence, ReceiptExtractor } from "../src/index.js";

// Public 1x1 PNG fixture. It contains no customer or payment data.
export const validPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nZsAAAAASUVORK5CYII=",
  "base64",
);

export const validEvidence: ReceiptEvidence = {
  provider: "InstaPay IPN",
  status: "Approved Transaction",
  amount: 1000,
  feeAmount: 1,
  totalDebitedAmount: 1001,
  transferAmountVisible: true,
  currency: "EGP",
  recipientName: "Example Merchant",
  recipientIdentifier: "12345678901234567",
  transferNote: "ORDER-123",
  senderAlias: "sender@instapay",
  senderMaskedAccount: "****1234",
  transferredAtText: "11 Aug 2026 09:32 AM",
  referenceId: "663889003527",
  detailsExpanded: true,
  language: "en",
  confidence: 0.99,
  suspicious: false,
  qualityWarnings: [],
};

export function extractorFor(evidence: unknown): ReceiptExtractor {
  return {
    extract() {
      return Promise.resolve({
        evidence,
        provenance: { provider: "test", model: "fixture-model", requestId: "req_fixture" },
      });
    },
  };
}

export const transaction = {
  subjectId: "order_123",
  amount: { value: "1000.00", currency: "EGP" },
  recipient: { type: "account" as const, value: "12345678901234567" },
  transferNote: "ORDER-123",
  validFrom: Date.UTC(2026, 7, 11, 6, 0),
  validUntil: Date.UTC(2026, 7, 11, 7, 0),
};
