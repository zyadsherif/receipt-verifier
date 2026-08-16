# Security, privacy, and threat model

## Security boundary

The package verifies visual consistency. Screenshots can be forged, models can be wrong, and the package cannot observe bank settlement. High-value or disputed transfers require authoritative bank evidence and human controls.

## Threats addressed

- Exact amount/currency/recipient/note mismatches.
- Failed, pending, unrelated, cropped, or contradictory evidence.
- Exact image and transaction-reference replay.
- Prompt injection printed inside receipt images.
- Model/provider outages and malformed output.
- Oversized or mislabeled image inputs.

## Host responsibilities

- Authenticate the caller and authorize the expected transaction server-side.
- Build expected transaction details from trusted backend state, never client totals.
- Fetch images only from trusted storage; this package deliberately does not fetch URLs.
- Implement atomic durable replay claims.
- Rate-limit submissions and bound AI spend.
- Keep review and reconciliation paths.
- Decide retention and deletion under applicable privacy law.

## Data handling

The OpenAI adapter sends the full image to the configured OpenAI project with `store: false`. Provider abuse monitoring and data-control policies remain governed by that provider and account. Review current provider terms before production.

The library does not persist images or keys and does not emit logs. Results may contain visible receipt facts; mask or encrypt them according to your system's policy. `maskSensitive` is provided for safe diagnostics.

## Reporting vulnerabilities

Follow [SECURITY.md](../SECURITY.md). Do not put secrets, real receipts, or personal payment data in public issues.
