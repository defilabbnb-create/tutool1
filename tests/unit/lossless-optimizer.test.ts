import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";

import {
  createWebpExport,
  createSharpPngFallback,
  optimizeLosslessRasterImage,
  pickSmallestCandidate,
} from "../../lib/lossless-optimizer";

async function createMetadataHeavyPng() {
  return sharp({
    create: {
      width: 24,
      height: 24,
      channels: 4,
      background: { r: 64, g: 128, b: 255, alpha: 1 },
    },
  })
    .png()
    .withExif({
      IFD0: {
        Artist: "PixelPress",
        Copyright:
          "This test adds EXIF metadata so lossless stripping has something to remove.",
        ImageDescription:
          "Metadata-heavy PNG fixture for lossless optimizer tests.",
      },
    })
    .toBuffer();
}

async function toRawPixels(buffer: Buffer) {
  return sharp(buffer).raw().toBuffer();
}

test("pickSmallestCandidate returns the smallest successful result", () => {
  const selected = pickSmallestCandidate([
    { size: 420, label: "original" },
    { size: 180, label: "optipng" },
    { size: 260, label: "pngcrush" },
  ]);

  assert.equal(selected.label, "optipng");
});

test("createSharpPngFallback keeps PNG pixels identical while shrinking metadata-heavy files", async () => {
  const original = await createMetadataHeavyPng();
  const optimized = await createSharpPngFallback(original);

  assert.equal(optimized.buffer.byteLength < original.byteLength, true);

  const [originalPixels, optimizedPixels] = await Promise.all([
    toRawPixels(original),
    toRawPixels(optimized.buffer),
  ]);

  assert.deepEqual(optimizedPixels, originalPixels);
});

test("optimizeLosslessRasterImage returns the smallest PNG candidate without changing format", async () => {
  const original = await createMetadataHeavyPng();
  const optimized = await optimizeLosslessRasterImage({
    buffer: original,
    mimeType: "image/png",
    fileName: "fixture.png",
  });

  assert.ok(optimized);
  assert.equal(optimized?.size <= original.byteLength, true);

  const metadata = await sharp(optimized!.buffer).metadata();
  assert.equal(metadata.format, "png");
  assert.equal(metadata.width, 24);
  assert.equal(metadata.height, 24);
});

test("createWebpExport returns a valid WebP alternative", async () => {
  const original = await createMetadataHeavyPng();
  const webp = await createWebpExport({
    buffer: original,
    fileName: "fixture.png",
  });

  const metadata = await sharp(webp.buffer).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(typeof webp.message, "string");
  assert.equal(webp.size > 0, true);
});
