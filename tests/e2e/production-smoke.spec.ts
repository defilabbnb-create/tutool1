import { expect, Page, test } from "@playwright/test";
import {
  createJpegPayload,
  createPngPayload,
  createTextPayload,
  gotoWithRetry,
} from "./helpers";

const runProductionSmokeTest = process.env.RUN_PRODUCTION_SMOKE_TEST === "1";

async function uploadSingle(
  page: Page,
  file: { name: string; mimeType: string; buffer: Buffer }
) {
  await page.locator('input[type="file"]').setInputFiles([file]);
}

async function waitForSuccess(page: Page) {
  const successItem = page.locator(".result-item-success").first();
  await expect(successItem).toBeVisible({ timeout: 45000 });
  return successItem;
}

test.describe("production smoke", () => {
  test.skip(
    !runProductionSmokeTest,
    "Production smoke tests run only in the dedicated smoke workflow."
  );

  test("homepage loads and format selector defaults to WebP", async ({ page }) => {
    await gotoWithRetry(page, "/");
    await expect(page).toHaveTitle(/Free Image Compressor/i);
    await expect(page.getByLabel("Output format")).toHaveValue("webp");
  });

  test("production upload flow covers selected formats, notify UI, and friendly errors", async ({
    page,
  }) => {
    const png = await createPngPayload("prod.png", 160, 160);
    const jpg = await createJpegPayload("prod.jpg", 180, 140);
    const bad = createTextPayload("bad.txt", "not an image");

    await gotoWithRetry(page, "/");

    await uploadSingle(page, png);
    let successItem = await waitForSuccess(page);
    await expect(successItem.locator(".result-fact").nth(3)).toContainText("WebP");

    let downloadPromise = page.waitForEvent("download");
    await successItem.locator(".download-button").click();
    expect((await downloadPromise).suggestedFilename()).toBe("prod.webp");

    await page.getByLabel("Output format").selectOption("png");
    await uploadSingle(page, png);
    successItem = await waitForSuccess(page);
    await expect(successItem.locator(".result-fact").nth(3)).toContainText("PNG");

    await page.getByLabel("Output format").selectOption("jpeg");
    await uploadSingle(page, jpg);
    successItem = await waitForSuccess(page);
    await expect(successItem.locator(".result-fact").nth(3)).toContainText("JPG");

    await page.getByLabel("Output format").selectOption("avif");
    await uploadSingle(page, png);
    successItem = await waitForSuccess(page);
    const formatText = await successItem
      .locator(".result-fact")
      .nth(3)
      .innerText();
    expect(["AVIF", "WebP"].some((value) => formatText.includes(value))).toBeTruthy();

    const notifySection = page.getByRole("region", { name: "Batch tools updates" });
    await expect(notifySection).toBeVisible();

    await uploadSingle(page, bad);
    await expect(page.locator(".result-item-error").first()).toContainText(
      /Only PNG, JPG, WebP, and AVIF images are supported/i
    );
  });
});
