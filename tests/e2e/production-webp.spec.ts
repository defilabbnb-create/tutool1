import { expect, test } from "@playwright/test";
import { createJpegPayload, createPngPayload, createTextPayload } from "./helpers";

const runProductionSmokeTest = process.env.RUN_PRODUCTION_SMOKE_TEST === "1";

test.describe("production API smoke validation", () => {
  test.skip(!runProductionSmokeTest, "Production API smoke validation runs only in the dedicated CI job.");

  test("validates output format routing and friendly errors against the live API", async ({
    request,
  }) => {
    const png = await createPngPayload("production-check.png", 48, 48);
    const jpg = await createJpegPayload("production-check.jpg", 60, 44);
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
    expect(defaultJson.mimeType).toBe("image/webp");
    expect(defaultJson.outputName).toBe("production-check.webp");
    expect(typeof defaultJson.methodUsed).toBe("string");

    const pngResponse = await request.post("/api/compress", {
      multipart: {
        file: {
          name: png.name,
          mimeType: png.mimeType,
          buffer: png.buffer,
        },
        format: "png",
      },
    });

    expect(pngResponse.ok()).toBeTruthy();
    const pngJson = await pngResponse.json();
    expect(pngJson.mimeType).toBe("image/png");
    expect(pngJson.outputName).toBe("production-check.png");
    expect(Boolean(pngJson.base64)).toBe(true);

    const jpgResponse = await request.post("/api/compress", {
      multipart: {
        file: {
          name: jpg.name,
          mimeType: jpg.mimeType,
          buffer: jpg.buffer,
        },
        format: "jpg",
      },
    });

    expect(jpgResponse.ok()).toBeTruthy();
    const jpgJson = await jpgResponse.json();
    expect(jpgJson.mimeType).toBe("image/jpeg");
    expect(jpgJson.outputName).toBe("production-check.jpg");

    const avifResponse = await request.post("/api/compress", {
      multipart: {
        file: {
          name: png.name,
          mimeType: png.mimeType,
          buffer: png.buffer,
        },
        format: "avif",
      },
    });

    expect(avifResponse.ok()).toBeTruthy();
    const avifJson = await avifResponse.json();
    expect(["image/avif", "image/webp"]).toContain(avifJson.mimeType);
    expect(["production-check.avif", "production-check.webp"]).toContain(
      avifJson.outputName
    );

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
    expect(invalidJson.error).toMatch(/Only PNG, JPG, WebP, and AVIF images are supported/i);
  });
});
