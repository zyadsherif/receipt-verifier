import { createHash } from "node:crypto";
import { ReceiptVerifierError } from "./errors.js";
import type { ImagePolicy, ReceiptImage, SupportedImageMediaType } from "./types.js";

const DEFAULT_POLICY = {
  maxBytes: 5 * 1024 * 1024,
  maxWidth: 4096,
  maxHeight: 4096,
  maxPixels: 12_000_000,
} as const;

export interface ValidatedImage {
  bytes: Uint8Array;
  mediaType: SupportedImageMediaType;
  sha256: string;
  width: number;
  height: number;
}

async function asBytes(data: ReceiptImage["data"]): Promise<Uint8Array> {
  if (data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

function pngDimensions(bytes: Uint8Array): [number, number] | undefined {
  if (bytes.length < 24) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return [view.getUint32(16), view.getUint32(20)];
}

function jpegDimensions(bytes: Uint8Array): [number, number] | undefined {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return undefined;
    const marker = bytes[offset + 1];
    if (marker === undefined) return undefined;
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    const length = (bytes[offset] ?? 0) * 256 + (bytes[offset + 1] ?? 0);
    if (length < 2 || offset + length > bytes.length) return undefined;
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      return [
        (bytes[offset + 5] ?? 0) * 256 + (bytes[offset + 6] ?? 0),
        (bytes[offset + 3] ?? 0) * 256 + (bytes[offset + 4] ?? 0),
      ];
    }
    offset += length;
  }
  return undefined;
}

function webpDimensions(bytes: Uint8Array): [number, number] | undefined {
  if (bytes.length < 30) return undefined;
  const type = String.fromCharCode(...bytes.slice(12, 16));
  if (type === "VP8X") {
    const width = 1 + (bytes[24] ?? 0) + ((bytes[25] ?? 0) << 8) + ((bytes[26] ?? 0) << 16);
    const height = 1 + (bytes[27] ?? 0) + ((bytes[28] ?? 0) << 8) + ((bytes[29] ?? 0) << 16);
    return [width, height];
  }
  if (type === "VP8L") {
    const b1 = bytes[21] ?? 0;
    const b2 = bytes[22] ?? 0;
    const b3 = bytes[23] ?? 0;
    const b4 = bytes[24] ?? 0;
    return [1 + (((b2 & 0x3f) << 8) | b1), 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | (b2 >> 6))];
  }
  if (type === "VP8 " && bytes.length >= 30) {
    return [
      ((bytes[27] ?? 0) * 256 + (bytes[26] ?? 0)) & 0x3fff,
      ((bytes[29] ?? 0) * 256 + (bytes[28] ?? 0)) & 0x3fff,
    ];
  }
  return undefined;
}

function signatureMatches(bytes: Uint8Array, mediaType: SupportedImageMediaType): boolean {
  if (mediaType === "image/png") {
    return [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  }
  if (mediaType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8;
  return (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  );
}

export async function validateImage(
  image: ReceiptImage,
  policy: ImagePolicy = {},
): Promise<ValidatedImage> {
  const limits = { ...DEFAULT_POLICY, ...policy };
  const bytes = await asBytes(image.data);
  if (bytes.length === 0) throw new ReceiptVerifierError("INVALID_IMAGE", "Image is empty.");
  if (bytes.length > limits.maxBytes) {
    throw new ReceiptVerifierError("INVALID_IMAGE", "Image exceeds the configured byte limit.");
  }
  if (!signatureMatches(bytes, image.mediaType)) {
    throw new ReceiptVerifierError(
      "INVALID_IMAGE",
      "Image bytes do not match the declared media type.",
    );
  }
  const dimensions =
    image.mediaType === "image/png"
      ? pngDimensions(bytes)
      : image.mediaType === "image/jpeg"
        ? jpegDimensions(bytes)
        : webpDimensions(bytes);
  if (!dimensions || dimensions[0] <= 0 || dimensions[1] <= 0) {
    throw new ReceiptVerifierError("INVALID_IMAGE", "Image dimensions could not be read.");
  }
  const [width, height] = dimensions;
  if (width > limits.maxWidth || height > limits.maxHeight || width * height > limits.maxPixels) {
    throw new ReceiptVerifierError(
      "INVALID_IMAGE",
      "Image dimensions exceed the configured limits.",
    );
  }
  return {
    bytes,
    mediaType: image.mediaType,
    width,
    height,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
