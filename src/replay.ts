import type {
  ReplayClaimRequest,
  ReplayClaimResult,
  ReplayClaimState,
  ReplayStore,
} from "./types.js";

/** Development/test-only replay store. Use durable atomic storage in production. */
export class InMemoryReplayStore implements ReplayStore {
  readonly #owners = new Map<string, string>();

  claim(request: ReplayClaimRequest): Promise<ReplayClaimResult> {
    const imageKey = `${request.scope}:image:${request.imageSha256}`;
    const referenceKey = request.normalizedReference
      ? `${request.scope}:reference:${request.normalizedReference}`
      : undefined;
    const imageState = this.#state(imageKey, request.subjectId);
    const referenceState = referenceKey ? this.#state(referenceKey, request.subjectId) : undefined;

    if (imageState !== "duplicate" && referenceState !== "duplicate") {
      this.#owners.set(imageKey, request.subjectId);
      if (referenceKey) this.#owners.set(referenceKey, request.subjectId);
    }
    return Promise.resolve({
      image: imageState,
      ...(referenceState ? { reference: referenceState } : {}),
    });
  }

  clear(): void {
    this.#owners.clear();
  }

  #state(key: string, subjectId: string): ReplayClaimState {
    const owner = this.#owners.get(key);
    if (!owner) return "claimed";
    return owner === subjectId ? "owned" : "duplicate";
  }
}
