import { expect, Page, test } from "@playwright/test";
import {
  createJpegPayload,
  createPngPayload,
  createWebpPayload,
  gotoWithRetry,
  parseFormattedBytes,
} from "./helpers";

async function uploadFiles(
  page: Page,
  files: Array<{ name: string; mimeType: string; buffer: Buffer }>
) {
  await gotoWithRetry(page, "/");
  await page.locator('input[type="file"]').setInputFiles(files);
}

test.describe("upload workflow", () => {
  test("uploads a valid PNG, shows progress, and finishes with a result", async ({
    page,
  }) => {
    test.setTimeout(45_000);
    const png = await createPngPayload("large-test.png", 1000, 1000);
    const originalSize = png.buffer.byteLength;

    await uploadFiles(page, [png]);

    await expect(page.getByText(/Uploading your image|Processing your image/i)).toBeVisible();
    await expect(page.locator(".result-progress")).toBeVisible();

    const successItem = page.locator(".result-item-success").first();
    await expect(successItem).toBeVisible({ timeout: 45000 });
    await expect(page.getByText("Your image has been successfully compressed. Download it below.")).toBeVisible();

    const compressedValue = await successItem
      .locator(".result-fact")
      .nth(1)
      .locator(".result-fact-value")
      .innerText();

    expect(parseFormattedBytes(compressedValue)).toBeLessThanOrEqual(originalSize);
    await expect(successItem.locator(".download-button")).toBeVisible();
  });

  test("handles JPG and WebP uploads and enables ZIP download for batch uploads", async ({
    page,
  }) => {
    const jpg = await createJpegPayload("photo.jpg");
    const webp = await createWebpPayload("banner.webp");

    await uploadFiles(page, [jpg, webp]);

    await expect(page.locator(".result-item-success")).toHaveCount(2, {
      timeout: 30000,
    });

    const downloadAllButton = page.getByRole("button", { name: "Download All" });
    await expect(downloadAllButton).toBeEnabled();

    const downloadPromise = page.waitForEvent("download");
    await downloadAllButton.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe("images.zip");
  });
});
