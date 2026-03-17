import { expect, test } from "@playwright/test";
import { gotoWithRetry } from "./helpers";

test("homepage loads and shows key UI", async ({ page }) => {
  await gotoWithRetry(page, "/");

  await expect(page).toHaveTitle(/PixelPress/i);
  await expect(
    page.getByRole("heading", { name: "Make Your Images Lighter in Seconds" })
  ).toBeVisible();
  await expect(
    page.getByText("Drop your images here or click to upload")
  ).toBeVisible();
  await expect(page.getByText("Supports PNG, JPG, WebP")).toBeVisible();
  await expect(page.getByText("Why PixelPress?")).toBeVisible();
  await expect(page.getByRole("link", { name: "Privacy" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Terms" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Contact" })).toBeVisible();
});
