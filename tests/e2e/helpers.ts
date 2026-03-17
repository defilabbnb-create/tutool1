import { expect, Page } from "@playwright/test";
import sharp from "sharp";

// Shared helpers keep Playwright fixtures small and repeatable.
type FilePayload = {
  name: string;
  mimeType: string;
  buffer: Buffer;
};

export async function createPngPayload(
  name: string,
  width = 1500,
  height = 1500
): Promise<FilePayload> {
  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 80, g: 155, b: 255, alpha: 1 },
    },
  })
    .png({ compressionLevel: 0 })
    .toBuffer();

  return {
    name,
    mimeType: "image/png",
    buffer,
  };
}

export async function createJpegPayload(
  name: string,
  width = 900,
  height = 600
): Promise<FilePayload> {
  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 220, g: 170, b: 120 },
    },
  })
    .jpeg({ quality: 92 })
    .toBuffer();

  return {
    name,
    mimeType: "image/jpeg",
    buffer,
  };
}

export async function createWebpPayload(
  name: string,
  width = 800,
  height = 500
): Promise<FilePayload> {
  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 120, g: 180, b: 130 },
    },
  })
    .webp({ quality: 90 })
    .toBuffer();

  return {
    name,
    mimeType: "image/webp",
    buffer,
  };
}

export function createTextPayload(name: string, text = "hello world"): FilePayload {
  return {
    name,
    mimeType: "text/plain",
    buffer: Buffer.from(text, "utf8"),
  };
}

export function createLargePngLikePayload(name: string): FilePayload {
  return {
    name,
    mimeType: "image/png",
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1, 1),
  };
}

export function parseFormattedBytes(value: string) {
  const match = value.trim().match(/^([\d.]+)\s(B|KB|MB|GB)$/i);

  if (!match) {
    throw new Error(`Unable to parse byte value: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2].toUpperCase();
  const power = ["B", "KB", "MB", "GB"].indexOf(unit);

  return amount * 1024 ** power;
}

export async function gotoWithRetry(page: Page, path: string, attempts = 3) {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expect(page.locator("body")).toBeVisible();
      await page.waitForLoadState("networkidle").catch(() => undefined);
      await page.waitForTimeout(300);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await page.waitForTimeout(1000);
      }
    }
  }

  throw lastError;
}
