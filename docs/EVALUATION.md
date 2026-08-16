# Evaluation and model upgrades

Models and receipt layouts change. Treat a model, prompt, schema, threshold, or normalizer change as a versioned policy change.

## Dataset

Use consented, redacted, or synthetic samples across Arabic/English and Android/iOS layouts:

- Genuine expanded successful transfers.
- Failed, pending, declined, and unrelated images.
- Cropped amount/reference/note/destination details.
- Fee-bearing transfers where total debit differs from sent amount.
- Masked phones/accounts/IBANs.
- Edited or contradictory evidence.
- Duplicate images and references.

Keep real private fixtures outside Git and npm under `eval/private/`.

## Release gate

- Zero known negative/adversarial fixtures may return `pass`.
- Uncertain cases may return `review`.
- Compare extraction fields and every deterministic check, not only aggregate verdict.
- Record model, prompt version, latency, and estimated cost.
- Run the current production model and candidate side by side before changing defaults.

`gpt-5.6-terra` is the balanced baseline, `gpt-5.6-luna` the cost candidate, and `gpt-5.6-sol` the difficult-layout benchmark. Account access and behavior may vary; verify against current official documentation and your own representative workload.
