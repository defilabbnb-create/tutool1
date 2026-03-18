import { expect, Page, test } from "@playwright/test";
import {
  createAvifPayload,
  createJpegPayload,
  createPngPayload,
  createTextPayload,
  createWebpPayload,
  gotoWithRetry,
  parseFormattedBytes,
} from "./helpers";

type UploadPayload = {
  name: string;
  mimeType: string;
  buffer: Buffer;
};

async function preparePage(page: Page) {
  await gotoWithRetry(page, "/");
}

async function uploadFiles(page: Page, files: UploadPayload[]) {
  await page.locator('input[type="file"]').setInputFiles(files);
}

async function waitForFirstSuccess(page: Page) {
  const successItem = page.locator(".result-item-success").first();
  await expect(successItem).toBeVisible({ timeout: 45000 });
  return successItem;
}

async function waitForLatestSuccess(page: Page) {
  const latestItem = page.locator(".result-list .result-item").first();
  await expect(latestItem).toHaveClass(/result-item-success/, {
    timeout: 45000,
  });
  return latestItem;
}

async function selectOutputFormat(page: Page, value: string) {
  await page.getByLabel("Output format").selectOption(value);
}

async function expectFormatResult(
  page: Page,
  file: UploadPayload,
  expectedFormatLabel: string,
  expectedExtension: string
) {
  await uploadFiles(page, [file]);

  const successItem = await waitForLatestSuccess(page);
  await expect(
    successItem.locator(".result-fact").nth(3).locator(".result-fact-value")
  ).toHaveText(expectedFormatLabel);

  const downloadPromise = page.waitForEvent("download");
  await successItem.locator(".download-button").click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    file.name.replace(/\.[^/.]+$/, expectedExtension)
  );
}

test.describe("upload workflow", () => {
  test("uploads a valid PNG, shows progress, and finishes with a result", async ({
    page,
  }) => {
    test.setTimeout(45_000);
    const png = await createPngPayload("large-test.png", 1000, 1000);
    const originalSize = png.buffer.byteLength;

    await preparePage(page);
    await uploadFiles(page, [png]);

    await expect(page.getByText(/Uploading your image|Processing your image/i)).toBeVisible();
    await expect(page.locator(".result-progress")).toBeVisible();

    const successItem = await waitForLatestSuccess(page);
    await expect(
      page.getByText("Your image has been successfully compressed. Download it below.")
    ).toBeVisible();

    const compressedValue = await successItem
      .locator(".result-fact")
      .nth(1)
      .locator(".result-fact-value")
      .innerText();

    expect(parseFormattedBytes(compressedValue)).toBeGreaterThan(0);
    expect(parseFormattedBytes(compressedValue)).toBeLessThanOrEqual(originalSize);
    await expect(successItem.locator(".download-button")).toBeVisible();
  });

  test("processes multiple files and enables ZIP download", async ({ page }) => {
    const first = await createPngPayload("first.png", 360, 360);
    const second = await createPngPayload("second.png", 420, 420);
    const third = await createPngPayload("third.png", 480, 480);

    await preparePage(page);
    await uploadFiles(page, [first, second, third]);

    await expect(page.locator(".result-item-success")).toHaveCount(3, {
      timeout: 30000,
    });
    await expect(page.getByText("first.png").first()).toBeVisible();
    await expect(page.getByText("second.png").first()).toBeVisible();
    await expect(page.getByText("third.png").first()).toBeVisible();

    const downloadAllButton = page.getByRole("button", {
      name: "Download All (.zip)",
    });
    await expect(downloadAllButton).toBeEnabled();

    const downloadPromise = page.waitForEvent("download");
    await downloadAllButton.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe("compressed-images.zip");
  });

  test("shows upgrade entry when exceeding batch limit", async ({ page }) => {
    const png = await createPngPayload("tiny.png", 24, 24);
    const files = Array.from({ length: 11 }, (_, index) => ({
      ...png,
      name: `tiny-${index + 1}.png`,
    }));

    await preparePage(page);
    await uploadFiles(page, files);

    await expect(
      page.getByText("Free version supports up to 10 images per batch.")
    ).toBeVisible();
    await expect(
      page.getByText("Need to compress more than 10 images?")
    ).toBeVisible();
    const limitUpgradeEntry = page.locator(".upgrade-entry").filter({
      hasText: "Need to compress more than 10 images?",
    });

    await limitUpgradeEntry.getByRole("button", { name: "Notify me" }).click();
    await expect(page.locator("#notify-section")).toBeInViewport();
  });

  test("shows upgrade entry after batch success", async ({ page }) => {
    const first = await createPngPayload("batch-one.png", 360, 360);
    const second = await createPngPayload("batch-two.png", 420, 420);
    const third = await createPngPayload("batch-three.png", 480, 480);

    await preparePage(page);
    await uploadFiles(page, [first, second, third]);

    await expect(page.locator(".result-item-success")).toHaveCount(3, {
      timeout: 30000,
    });
    await expect(
      page.getByRole("button", { name: "Download All (.zip)" })
    ).toBeVisible();
    const postSuccessUpgradeEntry = page.locator(".upgrade-entry").filter({
      hasText: "Compressing many images?",
    });
    await expect(postSuccessUpgradeEntry).toBeVisible();
    await expect(
      postSuccessUpgradeEntry.getByText(
        "We’re building faster batch processing and API access."
      )
    ).toBeVisible();
  });

  test("uses WebP by default when no format is changed", async ({ page }) => {
    const png = await createPngPayload("default-format.png", 600, 600);

    await preparePage(page);
    const selector = page.getByLabel("Output format");
    await expect(selector).toHaveValue("webp");

    await expectFormatResult(page, png, "WebP", ".webp");
    await expect(page.getByText("High quality")).toBeVisible();
    await expect(page.getByText("Balanced")).toBeVisible();
    await expect(page.getByText("Smallest size")).toBeVisible();
    await expect(page.getByText("Recommended lossy", { exact: true })).toBeVisible();
  });

  test("honours PNG output when selected", async ({ page }) => {
    const png = await createPngPayload("selected-png.png", 600, 600);

    await preparePage(page);
    await selectOutputFormat(page, "png");
    await expectFormatResult(page, png, "PNG", ".png");
  });

  test("honours JPG output when selected", async ({ page }) => {
    const png = await createPngPayload("selected-jpg.png", 620, 620);

    await preparePage(page);
    await selectOutputFormat(page, "jpeg");
    await expectFormatResult(page, png, "JPG", ".jpg");
  });

  test("honours WebP output when selected", async ({ page }) => {
    const jpg = await createJpegPayload("selected-webp.jpg", 620, 620);

    await preparePage(page);
    await selectOutputFormat(page, "webp");
    await expectFormatResult(page, jpg, "WebP", ".webp");
  });

  test("honours AVIF output when selected", async ({ page }) => {
    const png = await createPngPayload("selected-avif.png", 640, 640);

    await preparePage(page);
    await selectOutputFormat(page, "avif");
    await uploadFiles(page, [png]);

    const successItem = await waitForLatestSuccess(page);
    const formatValue = await successItem
      .locator(".result-fact")
      .nth(3)
      .locator(".result-fact-value")
      .innerText();

    expect(["AVIF", "WebP"]).toContain(formatValue);

    const downloadPromise = page.waitForEvent("download");
    await successItem.locator(".download-button").click();
    const download = await downloadPromise;

    expect(["selected-avif.avif", "selected-avif.webp"]).toContain(
      download.suggestedFilename()
    );
    await expect(page.getByText("High quality")).toBeVisible();
  });

  test("accepts AVIF uploads and can convert them to WebP", async ({ page }) => {
    const avif = await createAvifPayload("source.avif");

    await preparePage(page);
    await selectOutputFormat(page, "webp");
    await uploadFiles(page, [avif]);

    const successItem = await waitForLatestSuccess(page);
    await expect(
      successItem.locator(".result-fact").nth(3).locator(".result-fact-value")
    ).toHaveText("WebP");
  });

  test("handles non-image uploads with a friendly error", async ({ page }) => {
    const textFile = createTextPayload("not-an-image.txt", "not an image");
    let compressRequestCount = 0;

    page.on("request", (request) => {
      if (request.url().includes("/api/compress") && request.method() === "POST") {
        compressRequestCount += 1;
      }
    });

    await preparePage(page);
    await selectOutputFormat(page, "avif");
    await uploadFiles(page, [textFile]);

    await expect(page.locator(".result-item-error").first()).toContainText(
      /Only PNG, JPG, WebP, and AVIF images are supported|Only PNG, JPG, WebP, AVIF, and JXL images are supported/i
    );
    expect(compressRequestCount).toBe(0);
  });

  test("shows notify form after success and handles invalid then valid emails", async ({
    page,
  }) => {
    const png = await createPngPayload("notify.png", 600, 600);

    await preparePage(page);
    await uploadFiles(page, [png]);
    await waitForLatestSuccess(page);

    const notifySection = page.getByRole("region", {
      name: "Batch tools updates",
    });
    await expect(notifySection).toBeVisible();
    await expect(
      notifySection.getByText(
        "Compressing many images? We’re building batch tools and API access."
      )
    ).toBeVisible();

    await notifySection.getByRole("button", { name: "Notify me" }).click();
    await expect(
      notifySection.getByText("Please enter your email to get notified.")
    ).toBeVisible();

    await notifySection.getByLabel("Notify email").fill("person@example.com");
    await notifySection.getByRole("button", { name: "Notify me" }).click();
    await expect(
      notifySection.getByText(
        "Thanks! We’ll notify you when batch compression is ready."
      )
    ).toBeVisible({ timeout: 15000 });
  });

  test("notify still works from upgrade entry", async ({ page }) => {
    const png = await createPngPayload("upgrade-limit.png", 24, 24);
    const files = Array.from({ length: 11 }, (_, index) => ({
      ...png,
      name: `upgrade-limit-${index + 1}.png`,
    }));

    await preparePage(page);
    await uploadFiles(page, files);

    const limitUpgradeEntry = page.locator(".upgrade-entry").filter({
      hasText: "Need to compress more than 10 images?",
    });
    await limitUpgradeEntry.getByRole("button", { name: "Notify me" }).click();

    const notifySection = page.getByRole("region", {
      name: "Batch tools updates",
    });
    await expect(notifySection).toBeVisible();
    await notifySection.getByLabel("Notify email").fill("person@example.com");
    await notifySection.getByRole("button", { name: "Notify me" }).click();
    await expect(
      notifySection.getByText(
        "Thanks! We’ll notify you when batch compression is ready."
      )
    ).toBeVisible({ timeout: 15000 });
  });

  test("result cards show metrics and method used", async ({ page }) => {
    const png = await createPngPayload("metrics.png", 640, 640);

    await preparePage(page);
    await uploadFiles(page, [png]);

    const successItem = await waitForLatestSuccess(page);
    await expect(successItem.locator(".result-fact-label").getByText("Original")).toBeVisible();
    await expect(successItem.locator(".result-fact-label").getByText("Compressed")).toBeVisible();
    await expect(successItem.locator(".result-fact-label").getByText("Saved")).toBeVisible();
    await expect(successItem.locator(".result-fact-label").getByText("Format")).toBeVisible();
    await expect(successItem.locator(".result-fact-label").getByText("Method")).toBeVisible();
    await expect(successItem.locator(".result-format-note").first()).toBeVisible();
    await expect(page.getByText("Lossy preview options are shown below")).toBeVisible();
    await expect(page.getByText("Best size vs quality")).toBeVisible();
  });
});
