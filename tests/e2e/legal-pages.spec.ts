import { expect, test } from "@playwright/test";
import { gotoWithRetry } from "./helpers";

test.describe("legal and support pages", () => {
  test("privacy page loads", async ({ page }) => {
    await gotoWithRetry(page, "/privacy");
    await expect(
      page.getByRole("heading", { name: "Privacy Policy" })
    ).toBeVisible();
    await expect(page.getByText("Last updated")).toBeVisible();
    await expect(page.getByRole("link", { name: /home/i })).toBeVisible();
  });

  test("terms page loads", async ({ page }) => {
    await gotoWithRetry(page, "/terms");
    await expect(
      page.getByRole("heading", { name: "Terms of Use" })
    ).toBeVisible();
    await expect(page.getByText("Last updated")).toBeVisible();
    await expect(page.getByRole("link", { name: /home/i })).toBeVisible();
  });

  test("contact page loads", async ({ page }) => {
    await gotoWithRetry(page, "/contact");
    await expect(page.getByRole("heading", { name: "Contact" })).toBeVisible();
    await expect(page.getByText("hello@example.com")).toBeVisible();
    await expect(page.getByRole("link", { name: /home/i })).toBeVisible();
  });
});
