import { submitNotifyEmail } from "@/lib/notify-service";
import { saveNotifyEmail } from "@/lib/notify-storage";

export async function handleNotifyRequest(
  body: { email?: unknown; source?: unknown },
  saveEmail: typeof saveNotifyEmail = saveNotifyEmail
) {
  const email = typeof body?.email === "string" ? body.email : "";
  const source = typeof body?.source === "string" ? body.source : "website";
  return submitNotifyEmail(email, saveEmail, source);
}
