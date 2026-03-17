import { expect, test } from "@playwright/test";
import {
  createLargePngLikePayload,
  createPngPayload,
  createTextPayload,
  gotoWithRetry,
} from "./helpers";

test.describe("upload validation and errors", () => {
  test("rejects unsupported files with a user-friendly error", async ({ page }) => {
    await gotoWithRetry(page, "/");
    await page
      .locator('input[type="file"]')
      .setInputFiles([createTextPayload("notes.txt", "not an image")]);

    await expect(
      page.getByText("Only PNG, JPG, and WebP images are supported.")
    ).toBeVisible();
    await expect(page.locator(".result-item-error")).toContainText(
      "Only PNG, JPG, and WebP images are supported."
    );
  });

  test("rejects files larger than 10MB before upload", async ({ page }) => {
    await gotoWithRetry(page, "/");
    await page
      .locator('input[type="file"]')
      .setInputFiles([createLargePngLikePayload("huge-image.png")]);

    await expect(
      page.getByText("Each file must be 10MB or smaller.")
    ).toBeVisible();
    await expect(page.locator(".result-item-error")).toContainText(
      "Each file must be 10MB or smaller."
    );
  });

  test("rejects selecting more than 20 files", async ({ page }) => {
    await gotoWithRetry(page, "/");
    const png = await createPngPayload("tiny.png", 24, 24);
    const files = Array.from({ length: 21 }, (_, index) => ({
      ...png,
      name: `tiny-${index + 1}.png`,
    }));

    await page.locator('input[type="file"]').setInputFiles(files);

    await expect(
      page.getByText("You can upload up to 20 images at a time.")
    ).toBeVisible();
  });

  test("shows a clear failure state for corrupted image content", async ({
    page,
  }) => {
    await gotoWithRetry(page, "/");
    await page.locator('input[type="file"]').setInputFiles([
      {
        name: "broken.png",
        mimeType: "image/png",
        buffer: Buffer.from("not-a-real-image", "utf8"),
      },
    ]);

    const failedItem = page.locator(".result-item-error").first();
    await expect(failedItem).toBeVisible({ timeout: 15000 });
    await expect(failedItem).toContainText(
      "This file could not be read as a valid image."
    );
  });
});
