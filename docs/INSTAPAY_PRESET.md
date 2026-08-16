# Egyptian InstaPay preset

`instapayEgyptPreset()` recognizes bilingual Egyptian InstaPay/IPN receipt evidence while keeping the final decision deterministic.

## Extracted evidence

Provider, successful state, transfer amount, fee, total debit, currency, recipient name and identifier, transfer note, sender alias/account, local transaction time, reference, expanded-details state, language, confidence, suspicion, and quality warnings.

The prompt explicitly separates Transfer Amount/Amount Sent from fee-inclusive totals. Missing values remain absent; the model must not infer a cropped amount by subtraction.

## Default blocking checks

- InstaPay/IPN provenance.
- Successful state, excluding failed, rejected, cancelled, and pending language.
- Exact EGP amount by default.
- Expected currency and recipient.
- Cairo-local timestamp inside the host-provided window.
- Expanded details and transaction reference.
- Confidence of at least `0.85` and no suspicious evidence.
- Atomic image/reference replay claim.

Transfer-note matching activates when the transaction includes a note and may be made universally required through policy.

## Bilingual behavior

Arabic and Persian numerals normalize to ASCII. English and Arabic month/status forms are recognized. Receipt timestamps are interpreted in `Africa/Cairo`, including daylight-saving changes supported by the host Node runtime.

## Policy changes

Policy is trusted server configuration. Treat changes like payment-code changes: review the diff, run the evaluation set, record prompt/model provenance, and deploy conservatively.
