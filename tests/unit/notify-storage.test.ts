import assert from "node:assert/strict";
import test from "node:test";

import {
  isValidNotifyEmail,
  normalizeEmail,
  normalizeNotifySource,
  saveNotifyEmail,
  type NotifyRepository,
} from "../../lib/notify-storage";

test("normalizeEmail trims and lowercases", () => {
  assert.equal(normalizeEmail("  Test@Example.com "), "test@example.com");
});

test("isValidNotifyEmail validates basic addresses", () => {
  assert.equal(isValidNotifyEmail("person@example.com"), true);
  assert.equal(isValidNotifyEmail("bad-email"), false);
  assert.equal(isValidNotifyEmail("x".repeat(330) + "@example.com"), false);
});

test("normalizeNotifySource falls back to website for unknown values", () => {
  assert.equal(normalizeNotifySource("upgrade-limit"), "upgrade-limit");
  assert.equal(normalizeNotifySource("SOMETHING-ELSE"), "website");
});

test("saveNotifyEmail stores normalized emails", async () => {
  let capturedEmail = "";
  let capturedSource = "";

  const repository: NotifyRepository = {
    async insertEmail(email: string, source: string) {
      capturedEmail = email;
      capturedSource = source;
      return "inserted";
    },
  };

  const result = await saveNotifyEmail(
    " Test@Example.com ",
    "upgrade-limit",
    repository
  );

  assert.equal(capturedEmail, "test@example.com");
  assert.equal(capturedSource, "upgrade-limit");
  assert.equal(result.status, "inserted");
});

test("saveNotifyEmail reports duplicates gracefully", async () => {
  const repository: NotifyRepository = {
    async insertEmail() {
      return "duplicate";
    },
  };

  const result = await saveNotifyEmail(
    "test@example.com",
    "website",
    repository
  );

  assert.equal(result.status, "duplicate");
});
