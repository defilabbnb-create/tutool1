import { expect, test } from "@playwright/test";
import { createPngPayload, createTextPayload } from "./helpers";

const runProductionWebpTest = process.env.RUN_PRODUCTION_WEBP_TEST === "1";

test.describe("production WebP API validation", () => {
  test.skip(!runProductionWebpTest, "Production WebP validation runs only in the dedicated CI job.");

  test("validates PNG default behavior, requested WebP output, and invalid file handling", async ({
    request,
  }) => {
    const png = await createPngPayload("production-check.png", 48, 48);
    const badFile = createTextPayload("bad.txt", "not an image");

    const defaultResponse = await request.post("/api/compress", {
      multipart: {
        file: {
          name: png.name,
          mimeType: png.mimeType,
          buffer: png.buffer,
        },
      },
    });

    expect(defaultResponse.ok()).toBeTruthy();
    const defaultJson = await defaultResponse.json();
    expect(defaultJson.mimeType).toBe("image/png");
    expect(defaultJson.outputName).toBe("production-check.png");

    const webpResponse = await request.post("/api/compress", {
      multipart: {
        file: {
          name: png.name,
          mimeType: png.mimeType,
          buffer: png.buffer,
        },
        format: "webp",
      },
    });

    expect(webpResponse.ok()).toBeTruthy();
    const webpJson = await webpResponse.json();
    expect(webpJson.mimeType).toBe("image/webp");
    expect(webpJson.outputName).toBe("production-check.webp");
    expect(Boolean(webpJson.base64)).toBe(true);

    const invalidResponse = await request.post("/api/compress", {
      multipart: {
        file: {
          name: badFile.name,
          mimeType: badFile.mimeType,
          buffer: badFile.buffer,
        },
      },
    });

    expect(invalidResponse.status()).toBe(400);
    const invalidJson = await invalidResponse.json();
    expect(invalidJson.error).toMatch(/Only PNG, JPG, and WebP images are supported/i);
  });
});
