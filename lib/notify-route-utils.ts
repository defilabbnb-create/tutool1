import { submitNotifyEmail } from "@/lib/notify-service";
import { checkRateLimit } from "@/lib/rate-limit";
import { saveNotifyEmail } from "@/lib/notify-storage";

const NOTIFY_RATE_LIMIT_MESSAGE =
  "Too many requests. Please wait a moment and try again.";

export async function handleNotifyRequest(
  body: { email?: unknown; source?: unknown },
  saveEmail: typeof saveNotifyEmail = saveNotifyEmail,
  options: { clientIdentifier?: string } = {}
) {
  if (options.clientIdentifier) {
    const rateLimit = checkRateLimit(options.clientIdentifier, {
      bucket: "notify",
      windowMs: 60_000,
      maxRequestsPerWindow: 8,
      burstWindowMs: 10_000,
      maxRequestsPerBurst: 3,
    });

    if (!rateLimit.allowed) {
      return {
        status: 429,
        body: {
          error: NOTIFY_RATE_LIMIT_MESSAGE,
        },
      };
    }
  }

  const email = typeof body?.email === "string" ? body.email : "";
  const source = typeof body?.source === "string" ? body.source : "website";
  return submitNotifyEmail(email, saveEmail, source);
}
