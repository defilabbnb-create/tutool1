import assert from "node:assert/strict";
import test from "node:test";

import { handleNotifyRequest } from "../../lib/notify-route-utils";
import { resetRateLimitStore } from "../../lib/rate-limit";

test.beforeEach(() => {
  resetRateLimitStore();
});

test("POST /api/notify returns success for valid emails", async () => {
  const result = await handleNotifyRequest(
    { email: "person@example.com" },
    async () => ({
      status: "inserted",
    })
  );

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    success: true,
    message: "Thanks! We’ll notify you when batch compression is ready.",
    duplicate: false,
  });
});

test("POST /api/notify returns success for duplicates", async () => {
  const result = await handleNotifyRequest(
    { email: "person@example.com" },
    async () => ({
      status: "duplicate",
    })
  );

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    success: true,
    message: "Thanks! We’ll notify you when batch compression is ready.",
    duplicate: true,
  });
});

test("POST /api/notify returns a friendly validation error for invalid email", async () => {
  const result = await handleNotifyRequest({ email: "not-an-email" });

  assert.equal(result.status, 400);
  assert.deepEqual(result.body, {
    error: "Please enter a valid email address.",
  });
});

test("POST /api/notify accepts source metadata without changing UX response", async () => {
  let receivedSource = "";
  const result = await handleNotifyRequest(
    { email: "person@example.com", source: "upgrade-limit" },
    async (_email, source) => {
      receivedSource = source;
      return {
        status: "inserted",
      };
    }
  );

  assert.equal(receivedSource, "upgrade-limit");
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    success: true,
    message: "Thanks! We’ll notify you when batch compression is ready.",
    duplicate: false,
  });
});

test("POST /api/notify applies a friendly rate limit", async () => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await handleNotifyRequest(
      { email: `person${attempt}@example.com` },
      async () => ({
        status: "inserted",
      }),
      { clientIdentifier: "198.51.100.30" }
    );

    assert.equal(result.status, 200);
  }

  const limitedResult = await handleNotifyRequest(
    { email: "person4@example.com" },
    async () => ({
      status: "inserted",
    }),
    { clientIdentifier: "198.51.100.30" }
  );

  assert.equal(limitedResult.status, 429);
  assert.deepEqual(limitedResult.body, {
    error: "Too many requests. Please wait a moment and try again.",
  });
});
