import assert from "node:assert/strict";
import test from "node:test";

import {
  INVALID_NOTIFY_EMAIL_MESSAGE,
  NOTIFY_SERVER_ERROR_MESSAGE,
  NOTIFY_SUCCESS_MESSAGE,
  submitNotifyEmail,
} from "../../lib/notify-service";

test("submitNotifyEmail returns success for a valid email", async () => {
  const result = await submitNotifyEmail("person@example.com", async () => ({
    status: "inserted",
  }));

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    success: true,
    message: NOTIFY_SUCCESS_MESSAGE,
    duplicate: false,
  });
});

test("submitNotifyEmail treats duplicate emails as success", async () => {
  const result = await submitNotifyEmail("person@example.com", async () => ({
    status: "duplicate",
  }));

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    success: true,
    message: NOTIFY_SUCCESS_MESSAGE,
    duplicate: true,
  });
});

test("submitNotifyEmail rejects invalid emails", async () => {
  const result = await submitNotifyEmail("not-an-email", async () => ({
    status: "inserted",
  }));

  assert.equal(result.status, 400);
  assert.deepEqual(result.body, {
    error: INVALID_NOTIFY_EMAIL_MESSAGE,
  });
});

test("submitNotifyEmail hides internal storage errors", async () => {
  const result = await submitNotifyEmail("person@example.com", async () => {
    throw new Error("db down");
  });

  assert.equal(result.status, 500);
  assert.deepEqual(result.body, {
    error: NOTIFY_SERVER_ERROR_MESSAGE,
  });
});
