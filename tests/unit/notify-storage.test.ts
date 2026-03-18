import assert from "node:assert/strict";
import test from "node:test";

import {
  isValidNotifyEmail,
  normalizeEmail,
  saveNotifyEmail,
  type NotifyRepository,
} from "../../lib/notify-storage";

test("normalizeEmail trims and lowercases", () => {
  assert.equal(normalizeEmail("  Test@Example.com "), "test@example.com");
});

test("isValidNotifyEmail validates basic addresses", () => {
  assert.equal(isValidNotifyEmail("person@example.com"), true);
  assert.equal(isValidNotifyEmail("bad-email"), false);
});

test("saveNotifyEmail stores normalized emails", async () => {
  let capturedEmail = "";

  const repository: NotifyRepository = {
    async insertEmail(email: string) {
      capturedEmail = email;
      return "inserted";
    },
  };

  const result = await saveNotifyEmail(" Test@Example.com ", repository);

  assert.equal(capturedEmail, "test@example.com");
  assert.equal(result.status, "inserted");
});

test("saveNotifyEmail reports duplicates gracefully", async () => {
  const repository: NotifyRepository = {
    async insertEmail() {
      return "duplicate";
    },
  };

  const result = await saveNotifyEmail("test@example.com", repository);

  assert.equal(result.status, "duplicate");
});
