import { describe, expect, it } from "vitest";
import { InMemoryReplayStore } from "../src/index.js";

describe("InMemoryReplayStore", () => {
  it("claims atomically, permits same-subject retries, and rejects another subject", async () => {
    const store = new InMemoryReplayStore();
    const request = {
      scope: "merchant_1",
      subjectId: "order_1",
      imageSha256: "image_hash",
      normalizedReference: "REF123456",
    };
    await expect(store.claim(request)).resolves.toEqual({ image: "claimed", reference: "claimed" });
    await expect(store.claim(request)).resolves.toEqual({ image: "owned", reference: "owned" });
    await expect(store.claim({ ...request, subjectId: "order_2" })).resolves.toEqual({
      image: "duplicate",
      reference: "duplicate",
    });
    store.clear();
    await expect(store.claim(request)).resolves.toEqual({ image: "claimed", reference: "claimed" });
  });

  it("does not partially claim a request when one identity conflicts", async () => {
    const store = new InMemoryReplayStore();
    await store.claim({
      scope: "merchant",
      subjectId: "first",
      imageSha256: "one",
      normalizedReference: "REF111111",
    });
    const result = await store.claim({
      scope: "merchant",
      subjectId: "second",
      imageSha256: "two",
      normalizedReference: "REF111111",
    });
    expect(result).toEqual({ image: "claimed", reference: "duplicate" });
    await expect(
      store.claim({ scope: "merchant", subjectId: "third", imageSha256: "two" }),
    ).resolves.toEqual({ image: "claimed" });
  });
});
