import { submitNotifyEmail } from "@/lib/notify-service";
import { saveNotifyEmail } from "@/lib/notify-storage";

export async function handleNotifyRequest(
  body: { email?: unknown },
  saveEmail: typeof saveNotifyEmail = saveNotifyEmail
) {
  const email = typeof body?.email === "string" ? body.email : "";
  return submitNotifyEmail(email, saveEmail);
}
