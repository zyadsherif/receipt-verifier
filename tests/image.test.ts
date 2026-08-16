import { describe, expect, it } from "vitest";
import { ReceiptVerifierError } from "../src/index.js";
import { validateImage } from "../src/image.js";
import { validPng } from "./fixtures.js";

function jpeg(width: number, height: number): Buffer {
  return Buffer.from([
    0xff,
    0xd8,
    0xff,
    0xc0,
    0x00,
    0x0b,
    0x08,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x01,
    0x01,
    0x11,
    0x00,
    0xff,
    0xd9,
  ]);
}

function webp(type: "VP8X" | "VP8L" | "VP8 ", width: number, height: number): Buffer {
  const bytes = Buffer.alloc(30);
  bytes.write("RIFF", 0, "ascii");
  bytes.writeUInt32LE(22, 4);
  bytes.write("WEBP", 8, "ascii");
  bytes.write(type, 12, "ascii");
  if (type === "VP8X") {
    const w = width - 1;
    const h = height - 1;
    bytes[24] = w & 0xff;
    bytes[25] = (w >> 8) & 0xff;
    bytes[26] = (w >> 16) & 0xff;
    bytes[27] = h & 0xff;
    bytes[28] = (h >> 8) & 0xff;
    bytes[29] = (h >> 16) & 0xff;
  } else if (type === "VP8L") {
    const w = width - 1;
    const h = height - 1;
    bytes[21] = w & 0xff;
    bytes[22] = ((w >> 8) & 0x3f) | ((h & 0x03) << 6);
    bytes[23] = (h >> 2) & 0xff;
    bytes[24] = (h >> 10) & 0x0f;
  } else {
    bytes[26] = width & 0xff;
    bytes[27] = (width >> 8) & 0x3f;
    bytes[28] = height & 0xff;
    bytes[29] = (height >> 8) & 0x3f;
  }
  return bytes;
}

describe("image validation", () => {
  it("accepts PNG, JPEG, and all common WebP dimension headers", async () => {
    const jpegBytes = jpeg(3, 2);
    const jpegArrayBuffer = jpegBytes.buffer.slice(
      jpegBytes.byteOffset,
      jpegBytes.byteOffset + jpegBytes.byteLength,
    ) as ArrayBuffer;
    await expect(
      validateImage({ data: new Blob([validPng]), mediaType: "image/png" }),
    ).resolves.toMatchObject({ width: 1, height: 1 });
    await expect(
      validateImage({ data: jpegArrayBuffer, mediaType: "image/jpeg" }),
    ).resolves.toMatchObject({ width: 3, height: 2 });
    await expect(
      validateImage({ data: webp("VP8X", 20, 10), mediaType: "image/webp" }),
    ).resolves.toMatchObject({ width: 20, height: 10 });
    await expect(
      validateImage({ data: webp("VP8L", 20, 10), mediaType: "image/webp" }),
    ).resolves.toMatchObject({ width: 20, height: 10 });
    await expect(
      validateImage({ data: webp("VP8 ", 20, 10), mediaType: "image/webp" }),
    ).resolves.toMatchObject({ width: 20, height: 10 });
  });

  it("rejects empty, mismatched, unreadable, oversized, and over-dimension images", async () => {
    await expect(
      validateImage({ data: Buffer.alloc(0), mediaType: "image/png" }),
    ).rejects.toBeInstanceOf(ReceiptVerifierError);
    await expect(validateImage({ data: validPng, mediaType: "image/jpeg" })).rejects.toThrow(
      /media type/,
    );
    await expect(
      validateImage({ data: Buffer.from([0xff, 0xd8]), mediaType: "image/jpeg" }),
    ).rejects.toThrow(/dimensions/);
    await expect(
      validateImage({ data: validPng, mediaType: "image/png" }, { maxBytes: 2 }),
    ).rejects.toThrow(/byte limit/);
    await expect(
      validateImage({ data: jpeg(100, 50), mediaType: "image/jpeg" }, { maxWidth: 99 }),
    ).rejects.toThrow(/dimensions exceed/);
    await expect(
      validateImage({ data: jpeg(100, 50), mediaType: "image/jpeg" }, { maxPixels: 4_999 }),
    ).rejects.toThrow(/dimensions exceed/);
  });
});
