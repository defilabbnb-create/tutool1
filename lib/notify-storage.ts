import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type NotifyInsertStatus = "inserted" | "duplicate";

export type NotifySaveResult = {
  status: NotifyInsertStatus;
};

export type NotifyRepository = {
  insertEmail: (email: string, source: string) => Promise<NotifyInsertStatus>;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const testEmailStore = new Set<string>();

function canUseLocalTestFallback() {
  return process.env.PLAYWRIGHT_TEST_LOCAL === "1";
}

function createSupabaseNotifyRepository(): NotifyRepository {
  if (
    (!process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY) &&
    canUseLocalTestFallback()
  ) {
    return {
      async insertEmail(email: string) {
        if (testEmailStore.has(email)) {
          return "duplicate";
        }

        testEmailStore.add(email);
        return "inserted";
      },
    };
  }

  return {
    async insertEmail(email: string, source: string) {
      const supabase = getSupabaseAdminClient();
      const { error } = await supabase
        .from("notify_emails")
        .insert(
          {
            email,
            source,
          }
        );

      if (error) {
        if ("code" in error && error.code === "23505") {
          return "duplicate";
        }

        throw error;
      }

      return "inserted";
    },
  };
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidNotifyEmail(email: string) {
  return EMAIL_PATTERN.test(normalizeEmail(email));
}

export async function saveNotifyEmail(
  email: string,
  source = "website",
  repository: NotifyRepository = createSupabaseNotifyRepository()
): Promise<NotifySaveResult> {
  const normalizedEmail = normalizeEmail(email);
  const status = await repository.insertEmail(normalizedEmail, source);

  return { status };
}
