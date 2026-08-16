# Customization

## Provider adapter

Implement `ReceiptExtractor.extract(request)`. The request contains validated bytes, media type, trusted prompt, prompt version, schema name, and JSON Schema. Return untrusted evidence plus provider/model/request metadata. The preset validates evidence after the adapter returns it.

Throw `ReceiptExtractionError("malformed", ...)` for invalid structured output and `ReceiptExtractionError("unavailable", ...)` for timeouts, quotas, or provider failures.

## Custom rules

Use `defineRule` for type inference. Rules receive normalized evidence, the expected transaction, image SHA-256, normalized reference, and review time. They must return a unique ID, status, severity, code, and safe message.

Do not put financial decision policy into free-form extraction guidance. Guidance helps read a layout; typed rules decide whether visible facts match.

## Custom presets

A `ReceiptPreset` owns its ID, prompt version, trusted prompt, strict JSON Schema, evidence parser, reference normalization, replay requirement, and rules. This lets another transfer network plug into the same verifier without modifying the core.

## Production replay stores

`ReplayStore.claim` must atomically check and claim image and reference identities. A safe implementation uses a transaction plus unique constraints resembling:

```text
unique(scope, kind, value)
owner_subject_id
created_at
```

Within one database transaction:

1. Read or insert both `(scope, image, sha256)` and `(scope, reference, normalizedReference)`.
2. Return `claimed` for new rows, `owned` for the same subject, or `duplicate` for another subject.
3. If either identity conflicts, do not partially claim the other identity.

Do not use `InMemoryReplayStore` across production processes; it loses state on restart and cannot coordinate multiple instances.
