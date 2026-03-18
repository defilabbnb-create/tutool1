import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";

import {
  compressWithStrategy,
  createLossyPreviewOptions,
  createWebpExport,
  createSharpPngFallback,
  mimeTypeToOutputFormat,
  optimizeLosslessRasterImage,
  outputFormatToMimeType,
  pickSmallestCandidate,
} from "../../lib/lossless-optimizer";
import {
  getFormattedOutputName,
  getOutputExtension,
} from "../../lib/compress-route-utils";

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

test("format mapping helpers stay in sync", () => {
  assert.equal(mimeTypeToOutputFormat("image/png"), "png");
  assert.equal(mimeTypeToOutputFormat("image/jpeg"), "jpeg");
  assert.equal(mimeTypeToOutputFormat("image/webp"), "webp");
  assert.equal(mimeTypeToOutputFormat("image/avif"), "avif");
  assert.equal(outputFormatToMimeType("avif"), "image/avif");
});

test("output filename helpers keep extension logic aligned with returned mime types", () => {
  assert.equal(getOutputExtension("photo.png", "image/webp"), ".webp");
  assert.equal(getOutputExtension("photo.jpeg", "image/jpeg"), ".jpeg");
  assert.equal(getOutputExtension("photo.jpg", "image/jpeg"), ".jpg");
  assert.equal(
    getFormattedOutputName("photo.png", "image/avif"),
    "photo.avif"
  );
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

test("compressWithStrategy returns WebP by default-friendly strategy", async () => {
  const original = await createMetadataHeavyPng();
  const result = await compressWithStrategy({
    inputBuffer: original,
    inputMimeType: "image/png",
    targetFormat: "webp",
    originalName: "fixture.png",
    maxDimension: 2560,
  });

  assert.equal(result.mimeType, "image/webp");
  assert.equal(result.size > 0, true);
  assert.equal(typeof result.methodUsed, "string");
  assert.equal(typeof result.message, "string");
});

test("compressWithStrategy can return AVIF when requested", async () => {
  const original = await createMetadataHeavyPng();
  const result = await compressWithStrategy({
    inputBuffer: original,
    inputMimeType: "image/png",
    targetFormat: "avif",
    originalName: "fixture.png",
    maxDimension: 2560,
  });

  assert.equal(["image/avif", "image/webp"].includes(result.mimeType), true);
  assert.equal(typeof result.message, "string");
});

test("createLossyPreviewOptions returns quality previews with one recommendation", async () => {
  const original = await createMetadataHeavyPng();
  const previews = await createLossyPreviewOptions({
    buffer: original,
    fileName: "fixture.png",
    targetFormat: "webp",
    originalSize: 700 * 1024,
  });

  assert.equal(previews.length, 3);
  assert.deepEqual(
    previews.map((preview) => preview.quality),
    [80, 60, 50]
  );
  assert.equal(
    previews.filter((preview) => preview.isRecommended).length,
    1
  );
});
