import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";
import { POST } from "../../app/api/compress/route";
import { resetRateLimitStore } from "../../lib/rate-limit";
import {
  createApiJpgFile,
  createApiPngFile,
  createApiTextFile,
} from "./helpers";

test.beforeEach(() => {
  resetRateLimitStore();
});

function createCompressRequest(file: File, format?: string, ip = "198.51.100.10") {
  const formData = new FormData();
  formData.append("file", file);

  if (format) {
    formData.append("format", format);
  }

  return new NextRequest("http://localhost/api/compress", {
    method: "POST",
    body: formData,
    headers: new Headers({
      "x-forwarded-for": ip,
    }),
  });
}

function createEmptyCompressRequest(ip = "198.51.100.10") {
  return new NextRequest("http://localhost/api/compress", {
    method: "POST",
    body: new FormData(),
    headers: new Headers({
      "x-forwarded-for": ip,
    }),
  });
}

test("POST /api/compress defaults PNG uploads to WebP", async () => {
  const file = await createApiPngFile("fixture.png");
  const response = await POST(createCompressRequest(file, undefined, "198.51.100.11"));
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.equal(json.mimeType, "image/webp");
  assert.equal(json.outputName, "fixture.webp");
  assert.equal(typeof json.originalSize, "number");
  assert.equal(typeof json.compressedSize, "number");
  assert.equal(typeof json.savedPercent, "number");
  assert.equal(typeof json.methodUsed, "string");
  assert.equal(typeof json.formatMessage, "string");
});

test("POST /api/compress honors explicit PNG output", async () => {
  const file = await createApiPngFile("fixture.png");
  const response = await POST(createCompressRequest(file, "png", "198.51.100.12"));
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.equal(json.mimeType, "image/png");
  assert.equal(json.outputName, "fixture.png");
});

test("POST /api/compress honors explicit JPG output", async () => {
  const file = await createApiJpgFile("fixture.jpg");
  const response = await POST(createCompressRequest(file, "jpg", "198.51.100.13"));
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.equal(json.mimeType, "image/jpeg");
  assert.equal(json.outputName, "fixture.jpg");
});

test("POST /api/compress honors explicit WebP output", async () => {
  const file = await createApiPngFile("fixture.png");
  const response = await POST(createCompressRequest(file, "webp", "198.51.100.14"));
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.equal(json.mimeType, "image/webp");
  assert.equal(json.outputName, "fixture.webp");
});

test("POST /api/compress returns AVIF or explicit WebP fallback for AVIF requests", async () => {
  const file = await createApiPngFile("fixture.png");
  const response = await POST(createCompressRequest(file, "avif", "198.51.100.15"));
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.equal(["image/avif", "image/webp"].includes(json.mimeType), true);
  assert.equal(["fixture.avif", "fixture.webp"].includes(json.outputName), true);
  assert.equal(typeof json.formatMessage, "string");
});

test("POST /api/compress rejects non-image uploads with a friendly error", async () => {
  const file = createApiTextFile("bad.txt");
  const response = await POST(createCompressRequest(file, undefined, "198.51.100.16"));
  const json = await response.json();

  assert.equal(response.status, 400);
  assert.match(
    json.error,
    /Only PNG, JPG, WebP, and AVIF images are supported/i
  );
});

test("POST /api/compress rejects non-multipart requests with a friendly error", async () => {
  const response = await POST(
    new NextRequest("http://localhost/api/compress", {
      method: "POST",
      body: JSON.stringify({ not: "multipart" }),
      headers: new Headers({
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.17",
      }),
    })
  );
  const json = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(json, {
    error: "Please upload a valid image file.",
  });
});

test("POST /api/compress applies a friendly rate limit", async () => {
  const ip = "198.51.100.18";

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await POST(createEmptyCompressRequest(ip));
    assert.equal(response.status, 400);
  }

  const limitedResponse = await POST(createEmptyCompressRequest(ip));
  const json = await limitedResponse.json();

  assert.equal(limitedResponse.status, 429);
  assert.deepEqual(json, {
    error: "Too many requests. Please wait a moment and try again.",
  });
});
