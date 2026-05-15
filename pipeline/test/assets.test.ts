import { describe, expect, it } from "bun:test";
import sharp from "sharp";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

function isWebP(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF" &&
    Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP"
  );
}

describe("asset conversion", () => {
  it("converts PNG to WebP through the pinned sharp dependency", async () => {
    const webp = await sharp(tinyPng).webp({ quality: 82 }).toBuffer();

    expect(isWebP(webp)).toBe(true);
  });
});
