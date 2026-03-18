import { expect, Page, test } from "@playwright/test";
import {
  createJpegPayload,
  createPngPayload,
  createTextPayload,
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

async function waitForFirstSuccess(page: Page) {
  const successItem = page.locator(".result-item-success").first();
  await expect(successItem).toBeVisible({ timeout: 45000 });
  return successItem;
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

    const successItem = await waitForFirstSuccess(page);
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

  test("keeps PNG output by default and switches to WebP when requested", async ({
    page,
  }) => {
    test.setTimeout(45_000);

    const png = await createPngPayload("toggle-test.png", 600, 600);
    await page.addInitScript(() => {
      const append = FormData.prototype.append;
      const recorded: Array<{ name: string; value: string }> = [];

      Object.defineProperty(window, "__recordedFormDataFields", {
        value: recorded,
        configurable: true,
      });

      FormData.prototype.append = function patchedAppend(
        name: string,
        value: string | Blob
      ) {
        if (typeof value === "string") {
          recorded.push({ name, value });
        }

        return append.call(this, name, value);
      };
    });

    await gotoWithRetry(page, "/");

    const webpToggle = page.getByLabel(/Prefer WebP output for smaller downloads/i);
    await expect(webpToggle).not.toBeChecked();

    await page.locator('input[type="file"]').setInputFiles([png]);

    const defaultSuccessItem = await waitForFirstSuccess(page);
    await expect(
      defaultSuccessItem.locator(".result-fact").nth(3).locator(".result-fact-value")
    ).toHaveText("PNG");
    const initialFields = await page.evaluate(
      () =>
        (
          window as Window & {
            __recordedFormDataFields?: Array<{ name: string; value: string }>;
          }
        ).__recordedFormDataFields ?? []
    );
    expect(initialFields.some((field) => field.name === "format")).toBe(false);

    const defaultDownload = page.waitForEvent("download");
    await defaultSuccessItem.locator(".download-button").click();
    expect((await defaultDownload).suggestedFilename()).toBe("toggle-test.png");

    await webpToggle.check();
    await expect(webpToggle).toBeChecked();
    await page.evaluate(() => {
      (
        window as Window & {
          __recordedFormDataFields?: Array<{ name: string; value: string }>;
        }
      ).__recordedFormDataFields = [];
    });

    await page.locator('input[type="file"]').setInputFiles([png]);

    const webpSuccessItem = page.locator(".result-item-success").first();
    await expect(
      webpSuccessItem.locator(".result-fact").nth(3).locator(".result-fact-value")
    ).toHaveText("WebP", { timeout: 45000 });
    const webpFields = await page.evaluate(
      () =>
        (
          window as Window & {
            __recordedFormDataFields?: Array<{ name: string; value: string }>;
          }
        ).__recordedFormDataFields ?? []
    );
    expect(webpFields).toEqual(
      expect.arrayContaining([{ name: "format", value: "webp" }])
    );

    const webpDownload = page.waitForEvent("download");
    await webpSuccessItem.locator(".download-button").click();
    expect((await webpDownload).suggestedFilename()).toBe("toggle-test.webp");
  });

  test("does not trigger WebP processing for invalid non-image uploads", async ({
    page,
  }) => {
    const textFile = createTextPayload("not-an-image.txt", "not an image");
    let compressRequestCount = 0;

    page.on("request", (request) => {
      if (request.url().includes("/api/compress") && request.method() === "POST") {
        compressRequestCount += 1;
      }
    });

    await gotoWithRetry(page, "/");
    const webpToggle = page.getByLabel(/Prefer WebP output for smaller downloads/i);
    await webpToggle.check();

    await page.locator('input[type="file"]').setInputFiles([textFile]);

    await expect(page.locator(".result-item-error").first()).toContainText(
      /Only PNG, JPG, and WebP images are supported|Only PNG, JPG, WebP, and JXL images are supported/i
    );
    expect(compressRequestCount).toBe(0);
  });
});
