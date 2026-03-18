import { isValidNotifyEmail, saveNotifyEmail } from "@/lib/notify-storage";

export const INVALID_NOTIFY_EMAIL_MESSAGE = "Please enter a valid email address.";
export const NOTIFY_SUCCESS_MESSAGE =
  "Thanks! We’ll notify you when batch compression is ready.";
export const NOTIFY_SERVER_ERROR_MESSAGE =
  "Unable to save your email right now. Please try again.";

export async function submitNotifyEmail(
  email: string,
  saveEmail: typeof saveNotifyEmail = saveNotifyEmail
) {
  if (!isValidNotifyEmail(email)) {
    return {
      status: 400,
      body: {
        error: INVALID_NOTIFY_EMAIL_MESSAGE,
      },
    };
  }

  try {
    const result = await saveEmail(email);

    return {
      status: 200,
      body: {
        success: true,
        message: NOTIFY_SUCCESS_MESSAGE,
        duplicate: result.status === "duplicate",
      },
    };
  } catch {
    return {
      status: 500,
      body: {
        error: NOTIFY_SERVER_ERROR_MESSAGE,
      },
    };
  }
}
